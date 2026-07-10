// Libreria de animaciones CMU sobre el modelo PINTADO (conserva vertex colors)
// con el skinning mejorado por distancia + máscara por zonas.
globalThis.FileReader = class {
  _done(){ this.onload&&this.onload({target:this}); this.onloadend&&this.onloadend({target:this}); }
  readAsDataURL(b){ b.arrayBuffer().then(ab=>{ this.result=`data:${b.type||'application/octet-stream'};base64,${Buffer.from(ab).toString('base64')}`; this._done(); }); }
  readAsArrayBuffer(b){ b.arrayBuffer().then(ab=>{ this.result=ab; this._done(); }); }
};
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import fs from 'fs';

const MODEL='../arquero_pintado_v2.glb';
const OUT='arquero_final.glb';
const HIP='Hips';
const NAMES={ hips:'Hips', spine:'Spine1', head:'Head', leftUpperArm:'LeftArm', leftLowerArm:'LeftForeArm', rightUpperArm:'RightArm', rightLowerArm:'RightForeArm', leftUpperLeg:'LeftUpLeg', leftLowerLeg:'LeftLeg', leftFoot:'LeftFoot', rightUpperLeg:'RightUpLeg', rightLowerLeg:'RightLeg', rightFoot:'RightFoot' };
const BONE_ORDER=["hips","spine","head","leftUpperArm","leftLowerArm","rightUpperArm","rightLowerArm","leftUpperLeg","leftLowerLeg","rightUpperLeg","rightLowerLeg","leftFoot","rightFoot"];
const LIB={caminar:'cmu_walk.bvh',correr:'cmu_correr.bvh',saltar:'cmu_saltar.bvh',patear:'cmu_patear.bvh',golpear:'cmu_golpear.bvh',bailar:'cmu_bailar.bvh'};

function collectGeometry(object){
  object.updateMatrixWorld(true);const geos=[];
  object.traverse(c=>{if(c.isMesh&&c.geometry){let g=c.geometry.clone();g.applyMatrix4(c.matrixWorld);if(!g.getAttribute('normal'))g.computeVertexNormals();const cl=new THREE.BufferGeometry();if(g.index)cl.setIndex(g.index.clone());cl.setAttribute('position',g.getAttribute('position').clone());cl.setAttribute('normal',g.getAttribute('normal').clone());const col=g.getAttribute('color');if(col)cl.setAttribute('color',col.clone());geos.push(cl);}});
  let m=geos.length===1?geos[0]:mergeGeometries(geos,false);
  m.computeBoundingBox();const c=new THREE.Vector3();m.boundingBox.getCenter(c);
  m.translate(-c.x,-m.boundingBox.min.y,-c.z);m.computeBoundingBox();return m;
}
function mk(n,x,y,z){const b=new THREE.Bone();b.name=n;b.position.set(x,y,z);return b;}
function buildSkeleton(geo){
  const size=new THREE.Vector3();geo.boundingBox.getSize(size);
  const H=size.y||1,halfW=(size.x||H*0.3)/2;
  const feetTop=0.08*H,kneeY=0.25*H,hipY=0.5*H,elbowY=0.62*H,shoulderY=0.8*H,neckY=0.86*H,topY=H;
  const shoulderX=0.62*halfW,hipX=0.30*halfW;
  const b={};
  b.hips=mk('hips',0,hipY,0);b.spine=mk('spine',0,shoulderY-hipY,0);b.head=mk('head',0,(neckY+topY)/2-shoulderY,0);
  b.hips.add(b.spine);b.spine.add(b.head);
  for(const s of['left','right']){const sx=s==='left'?-1:1;
    const uA=mk(s+'UpperArm',sx*shoulderX,0,0),lA=mk(s+'LowerArm',0,-(shoulderY-elbowY),0);uA.add(lA);b.spine.add(uA);b[s+'UpperArm']=uA;b[s+'LowerArm']=lA;
    const uL=mk(s+'UpperLeg',sx*hipX,0,0),lL=mk(s+'LowerLeg',0,-(hipY-kneeY),0),ft=mk(s+'Foot',0,-(kneeY-feetTop),0);lL.add(ft);uL.add(lL);b.hips.add(uL);b[s+'UpperLeg']=uL;b[s+'LowerLeg']=lL;b[s+'Foot']=ft;}
  return {b,H,halfW,dims:{feetTop,kneeY,hipY,elbowY,shoulderY,neckY}};
}
function distSeg(px,py,pz,ax,ay,az,bx,by,bz){const abx=bx-ax,aby=by-ay,abz=bz-az;const apx=px-ax,apy=py-ay,apz=pz-az;const abl=abx*abx+aby*aby+abz*abz||1e-9;let t=(apx*abx+apy*aby+apz*abz)/abl;t=t<0?0:t>1?1:t;const dx=apx-abx*t,dy=apy-aby*t,dz=apz-abz*t;return Math.sqrt(dx*dx+dy*dy+dz*dz);}
function skinDistance(geo,bones,H,dims,halfW){
  bones.hips.updateMatrixWorld(true);
  const W={};for(const n of BONE_ORDER){const v=new THREE.Vector3();bones[n].getWorldPosition(v);W[n]=v;}
  const headLen=0.12*H,handLen=(new THREE.Vector3().subVectors(W.leftLowerArm,W.leftUpperArm)).length()*0.9,footLen=0.12*H;
  const ext=(from,to,len)=>{const d=new THREE.Vector3().subVectors(to,from);if(d.length()<1e-6)d.set(0,-1,0);d.normalize();return to.clone().addScaledVector(d,len);};
  const hipsBot=W.hips.clone().add(new THREE.Vector3(0,-0.12*H,0));
  const seg={hips:[hipsBot,W.spine],spine:[W.spine,W.head],head:[W.head,W.head.clone().add(new THREE.Vector3(0,headLen,0))],
    leftUpperArm:[W.leftUpperArm,W.leftLowerArm],leftLowerArm:[W.leftLowerArm,ext(W.leftUpperArm,W.leftLowerArm,handLen)],
    rightUpperArm:[W.rightUpperArm,W.rightLowerArm],rightLowerArm:[W.rightLowerArm,ext(W.rightUpperArm,W.rightLowerArm,handLen)],
    leftUpperLeg:[W.leftUpperLeg,W.leftLowerLeg],leftLowerLeg:[W.leftLowerLeg,W.leftFoot],leftFoot:[W.leftFoot,W.leftFoot.clone().add(new THREE.Vector3(0,0,footLen))],
    rightUpperLeg:[W.rightUpperLeg,W.rightLowerLeg],rightLowerLeg:[W.rightLowerLeg,W.rightFoot],rightFoot:[W.rightFoot,W.rightFoot.clone().add(new THREE.Vector3(0,0,footLen))]};
  const idx={};BONE_ORDER.forEach((n,i)=>idx[n]=i);
  const {feetTop,kneeY,hipY,elbowY,shoulderY,neckY}=dims;const armThresh=0.45*halfW;
  const pos=geo.getAttribute('position'),N=pos.count;const si=new Uint16Array(N*4),sw=new Float32Array(N*4);
  const P=5.0;
  function allowed(x,y){const s=x<0?'left':'right';
    if(y>=neckY)return['head','spine'];
    if(y>=shoulderY)return['spine','head'];
    if(y>=hipY){if(Math.abs(x)>armThresh)return[s+'UpperArm',s+'LowerArm','spine'];return['spine','hips','head'];}
    if(y>=kneeY)return[s+'UpperLeg','hips',s+'LowerLeg'];
    if(y>=feetTop)return[s+'LowerLeg',s+'UpperLeg',s+'Foot'];
    return[s+'Foot',s+'LowerLeg'];}
  for(let v=0;v<N;v++){
    const px=pos.getX(v),py=pos.getY(v),pz=pos.getZ(v);
    const scored=allowed(px,py).map(n=>{const s=seg[n];return{n,d:distSeg(px,py,pz,s[0].x,s[0].y,s[0].z,s[1].x,s[1].y,s[1].z)};}).sort((a,b)=>a.d-b.d).slice(0,4);
    let tot=0;const w=scored.map(o=>{const ww=1/Math.pow(o.d+1e-4,P);tot+=ww;return ww;});
    for(let k=0;k<4;k++){if(k<scored.length){si[v*4+k]=idx[scored[k].n];sw[v*4+k]=w[k]/tot;}else{si[v*4+k]=idx[scored[0].n];sw[v*4+k]=0;}}
  }
  return {si,sw};
}
function assemble(geo,b,si,sw){
  geo=geo.clone();
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si.slice(),4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw.slice(),4));
  const hasColor=!!geo.getAttribute('color');
  const mat=new THREE.MeshStandardMaterial({color:hasColor?0xffffff:0xcbd5e1,vertexColors:hasColor,roughness:0.8,metalness:0.02,side:THREE.DoubleSide});
  const clone={};for(const n of BONE_ORDER)clone[n]=mk(n,b[n].position.x,b[n].position.y,b[n].position.z);
  clone.hips.add(clone.spine);clone.spine.add(clone.head);
  for(const s of['left','right']){clone.spine.add(clone[s+'UpperArm']);clone[s+'UpperArm'].add(clone[s+'LowerArm']);clone.hips.add(clone[s+'UpperLeg']);clone[s+'UpperLeg'].add(clone[s+'LowerLeg']);clone[s+'LowerLeg'].add(clone[s+'Foot']);}
  const skel=new THREE.Skeleton(BONE_ORDER.map(n=>clone[n]));
  const mesh=new THREE.SkinnedMesh(geo,mat);mesh.add(clone.hips);mesh.bind(skel);mesh.frustumCulled=false;
  return {mesh,bones:clone};
}
function retarget(mesh,bvhFile){
  const bvh=new BVHLoader().parse(fs.readFileSync(bvhFile,'utf8'));
  const clip=SkeletonUtils.retargetClip(mesh,bvh.skeleton,bvh.clip,{hip:HIP,names:NAMES,useFirstFramePosition:true});
  clip.tracks=clip.tracks.filter(t=>!t.name.endsWith('.position')||t.name.startsWith('hips'));
  return clip;
}

const buf=fs.readFileSync(MODEL);const abuf=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
new GLTFLoader().parse(abuf,'',async(gltf)=>{
  const geo=collectGeometry(gltf.scene);
  console.log('color attr:',!!geo.getAttribute('color'),'| verts:',geo.getAttribute('position').count);
  const {b,H,halfW,dims}=buildSkeleton(geo);
  const {si,sw}=skinDistance(geo,b,H,dims,halfW);
  const lib=assemble(geo,b,si,sw);const clips=[];
  for(const [name,file] of Object.entries(LIB)){
    if(!fs.existsSync(file)){console.log('falta',file);continue;}
    const c=retarget(lib.mesh,file);c.name=name;clips.push(c);lib.mesh.skeleton.pose();
    console.log('OK',name,c.duration.toFixed(2)+'s');
  }
  lib.mesh.skeleton.pose();lib.mesh.updateMatrixWorld(true);
  const glb=await new Promise((res,rej)=>new GLTFExporter().parse(lib.mesh,res,rej,{binary:true,animations:clips,onlyVisible:true}));
  fs.writeFileSync(OUT,Buffer.from(glb));
  console.log('EXPORT',OUT,(glb.byteLength/1024/1024).toFixed(2),'MB | clips:',clips.map(c=>c.name).join(','));
},e=>{console.log('LOAD ERR',e);process.exit(1);});
