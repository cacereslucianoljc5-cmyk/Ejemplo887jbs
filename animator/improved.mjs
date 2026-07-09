// Improved skinning: distance-to-bone-segment weighting (top-4, smooth falloff)
// vs the old hard zone assignment. Exports v2 GLB + emits frames for both to compare.
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

const MODEL='archer_lite.glb';
const HIP='Hips';
const NAMES={ hips:'Hips', spine:'Spine1', head:'Head', leftUpperArm:'LeftArm', leftLowerArm:'LeftForeArm', rightUpperArm:'RightArm', rightLowerArm:'RightForeArm', leftUpperLeg:'LeftUpLeg', leftLowerLeg:'LeftLeg', leftFoot:'LeftFoot', rightUpperLeg:'RightUpLeg', rightLowerLeg:'RightLeg', rightFoot:'RightFoot' };
const BONE_ORDER=["hips","spine","head","leftUpperArm","leftLowerArm","rightUpperArm","rightLowerArm","leftUpperLeg","leftLowerLeg","rightUpperLeg","rightLowerLeg","leftFoot","rightFoot"];
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a||1e-6)));return t*t*(3-2*t);};

function collectGeometry(object){object.updateMatrixWorld(true);const geos=[];object.traverse(c=>{if(c.isMesh&&c.geometry){let g=c.geometry.clone();g.applyMatrix4(c.matrixWorld);g=g.index?g.toNonIndexed():g;if(!g.getAttribute('normal'))g.computeVertexNormals();const cl=new THREE.BufferGeometry();cl.setAttribute('position',g.getAttribute('position').clone());cl.setAttribute('normal',g.getAttribute('normal').clone());geos.push(cl);}});let m=geos.length===1?geos[0]:mergeGeometries(geos,false);m.computeBoundingBox();const c=new THREE.Vector3();m.boundingBox.getCenter(c);m.translate(-c.x,-m.boundingBox.min.y,-c.z);m.computeBoundingBox();return m;}
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
  b.hips.userData.baseY=hipY;
  return {b,H,halfW,dims:{feetTop,kneeY,hipY,elbowY,shoulderY,neckY,topY,shoulderX,hipX}};
}

// ---- OLD zone-based skinning (for comparison) ----
function skinZones(geo,b,dims,H,halfW){
  const {feetTop,kneeY,hipY,elbowY,shoulderY,neckY}=dims;const feather=0.05*H;const armThresh=0.45*halfW;
  const idx={};BONE_ORDER.forEach((n,i)=>idx[n]=i);
  const pos=geo.getAttribute('position'),N=pos.count;const si=new Uint16Array(N*4),sw=new Float32Array(N*4);
  const set2=(v,a,aw,bb=a,bw=0)=>{si[v*4]=idx[a];si[v*4+1]=idx[bb];sw[v*4]=aw;sw[v*4+1]=bw;};
  for(let v=0;v<N;v++){const x=pos.getX(v),y=pos.getY(v),s=x<0?'left':'right';
    if(y>=neckY)set2(v,'head',1);
    else if(y>=shoulderY){const t=ss(shoulderY,neckY,y);set2(v,'spine',1-t,'head',t);}
    else if(y>=hipY){if(Math.abs(x)>armThresh){if(y>=elbowY)set2(v,s+'UpperArm',1);else{const t=ss(elbowY-feather,elbowY+feather,y);set2(v,s+'LowerArm',1-t,s+'UpperArm',t);}}else if(y<hipY+feather){const t=ss(hipY,hipY+feather,y);set2(v,'hips',1-t,'spine',t);}else set2(v,'spine',1);}
    else if(y>=kneeY){if(y>hipY-feather){const t=ss(hipY-feather,hipY,y);set2(v,s+'UpperLeg',1-t,'hips',t);}else if(y<kneeY+feather){const t=ss(kneeY-feather,kneeY+feather,y);set2(v,s+'LowerLeg',1-t,s+'UpperLeg',t);}else set2(v,s+'UpperLeg',1);}
    else if(y>=feetTop)set2(v,s+'LowerLeg',1);else set2(v,s+'Foot',1);}
  return {si,sw};
}

// ---- NEW distance-to-segment skinning ----
function distSeg(px,py,pz,ax,ay,az,bx,by,bz){
  const abx=bx-ax,aby=by-ay,abz=bz-az;const apx=px-ax,apy=py-ay,apz=pz-az;
  const abl=abx*abx+aby*aby+abz*abz||1e-9;let t=(apx*abx+apy*aby+apz*abz)/abl;t=t<0?0:t>1?1:t;
  const dx=apx-abx*t,dy=apy-aby*t,dz=apz-abz*t;return Math.sqrt(dx*dx+dy*dy+dz*dz);
}
function skinDistance(geo,bones,H,dims,halfW){
  // world-space rest positions of bones
  const skelMeshRoot=bones.hips;skelMeshRoot.updateMatrixWorld(true);
  const W={};for(const n of BONE_ORDER){const v=new THREE.Vector3();bones[n].getWorldPosition(v);W[n]=v;}
  const headLen=0.12*H,handLen=(new THREE.Vector3().subVectors(W.leftLowerArm,W.leftUpperArm)).length()*0.9,footLen=0.12*H;
  const ext=(from,to,len)=>{const d=new THREE.Vector3().subVectors(to,from);if(d.length()<1e-6)d.set(0,-1,0);d.normalize();return to.clone().addScaledVector(d,len);};
  // hips: extend down to crotch so pelvis is stable
  const hipsBot=W.hips.clone().add(new THREE.Vector3(0,-0.12*H,0));
  const seg={
    hips:[hipsBot,W.spine],
    spine:[W.spine,W.head],
    head:[W.head,W.head.clone().add(new THREE.Vector3(0,headLen,0))],
    leftUpperArm:[W.leftUpperArm,W.leftLowerArm],
    leftLowerArm:[W.leftLowerArm,ext(W.leftUpperArm,W.leftLowerArm,handLen)],
    rightUpperArm:[W.rightUpperArm,W.rightLowerArm],
    rightLowerArm:[W.rightLowerArm,ext(W.rightUpperArm,W.rightLowerArm,handLen)],
    leftUpperLeg:[W.leftUpperLeg,W.leftLowerLeg],
    leftLowerLeg:[W.leftLowerLeg,W.leftFoot],
    leftFoot:[W.leftFoot,W.leftFoot.clone().add(new THREE.Vector3(0,0,footLen))],
    rightUpperLeg:[W.rightUpperLeg,W.rightLowerLeg],
    rightLowerLeg:[W.rightLowerLeg,W.rightFoot],
    rightFoot:[W.rightFoot,W.rightFoot.clone().add(new THREE.Vector3(0,0,footLen))],
  };
  const idx={};BONE_ORDER.forEach((n,i)=>idx[n]=i);
  const {feetTop,kneeY,hipY,elbowY,shoulderY,neckY}=dims;const armThresh=0.45*halfW;
  const pos=geo.getAttribute('position'),N=pos.count;const si=new Uint16Array(N*4),sw=new Float32Array(N*4);
  const P=5.0;        // falloff exponent
  // region mask: which bones a vertex is ALLOWED to follow (prevents hood/torso capture by arms)
  function allowed(x,y){const s=x<0?'left':'right';
    if(y>=neckY)return['head','spine'];
    if(y>=shoulderY)return['spine','head'];
    if(y>=hipY){ if(Math.abs(x)>armThresh)return[s+'UpperArm',s+'LowerArm','spine']; return['spine','hips','head']; }
    if(y>=kneeY)return[s+'UpperLeg','hips',s+'LowerLeg'];
    if(y>=feetTop)return[s+'LowerLeg',s+'UpperLeg',s+'Foot'];
    return[s+'Foot',s+'LowerLeg'];
  }
  for(let v=0;v<N;v++){
    const px=pos.getX(v),py=pos.getY(v),pz=pos.getZ(v);
    const cand=allowed(px,py);
    const scored=cand.map(n=>{const s=seg[n];return{n,d:distSeg(px,py,pz,s[0].x,s[0].y,s[0].z,s[1].x,s[1].y,s[1].z)};}).sort((a,b)=>a.d-b.d).slice(0,4);
    let tot=0;const w=scored.map(o=>{const ww=1/Math.pow(o.d+1e-4,P);tot+=ww;return ww;});
    for(let k=0;k<4;k++){if(k<scored.length){si[v*4+k]=idx[scored[k].n];sw[v*4+k]=w[k]/tot;}else{si[v*4+k]=idx[scored[0].n];sw[v*4+k]=0;}}
  }
  return {si,sw};
}

function assemble(geo,b,si,sw){
  geo=geo.clone();
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si.slice(),4));
  geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw.slice(),4));
  const mat=new THREE.MeshStandardMaterial({color:0xcbd5e1,roughness:0.75,metalness:0.05,side:THREE.DoubleSide});
  // fresh bone hierarchy clone so the two rigs don't share state
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
function sampleFrames(mesh,clip,nF){
  const mixer=new THREE.AnimationMixer(mesh);mixer.clipAction(clip).play();
  const geo=mesh.geometry,N=geo.getAttribute('position').count;const M=Math.min(8000,N);const rng=[];for(let i=0;i<M;i++)rng.push(Math.floor(i*N/M));
  const frames=[];const tmp=new THREE.Vector3();
  for(let k=0;k<nF;k++){const t=(k/(nF-1))*clip.duration*0.95;mixer.setTime(t);mesh.skeleton.update();mesh.updateMatrixWorld(true);
    const pts=[];for(const vi of rng){tmp.set(geo.getAttribute('position').getX(vi),geo.getAttribute('position').getY(vi),geo.getAttribute('position').getZ(vi));mesh.applyBoneTransform(vi,tmp);pts.push([+tmp.x.toFixed(4),+tmp.y.toFixed(4)]);}frames.push(pts);}
  return frames;
}

const buf=fs.readFileSync(MODEL);const abuf=buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
new GLTFLoader().parse(abuf,'',async(gltf)=>{
  const geo=collectGeometry(gltf.scene);
  const {b,H,halfW,dims}=buildSkeleton(geo);
  b.hips.updateMatrixWorld(true);

  const zoneW=skinZones(geo,b,dims,H,halfW);
  const distW=skinDistance(geo,b,H,dims,halfW);

  // sanity: report avg #bones with weight>0.05 per vertex (blend richness)
  const richness=(sw)=>{let s=0,N=sw.length/4;for(let v=0;v<N;v++){let c=0;for(let k=0;k<4;k++)if(sw[v*4+k]>0.05)c++;s+=c;}return (s/N).toFixed(2);};
  console.log('avg blended bones/vertex — zone:',richness(zoneW.sw),' distance:',richness(distW.sw));

  const BVHS={caminar:'cmu_walk.bvh',correr:'cmu_correr.bvh'};
  const out={H,anims:{}};
  for(const [name,file] of Object.entries(BVHS)){
    if(!fs.existsSync(file)){console.log('missing',file);continue;}
    const zone=assemble(geo,b,zoneW.si,zoneW.sw);const zc=retarget(zone.mesh,file);
    const dist=assemble(geo,b,distW.si,distW.sw);const dc=retarget(dist.mesh,file);
    out.anims[name]={zone:sampleFrames(zone.mesh,zc,6),dist:sampleFrames(dist.mesh,dc,6)};
    console.log('retargeted',name,'dur',dc.duration.toFixed(2));
  }
  fs.writeFileSync('compare.json',JSON.stringify(out));
  console.log('wrote compare.json');

  // Export the improved full library GLB (6 anims) with region-masked distance skinning
  const LIB={caminar:'cmu_walk.bvh',correr:'cmu_correr.bvh',saltar:'cmu_saltar.bvh',patear:'cmu_patear.bvh',golpear:'cmu_golpear.bvh',bailar:'cmu_bailar.bvh'};
  const lib2=assemble(geo,b,distW.si,distW.sw);const clips2=[];
  for(const [name,file] of Object.entries(LIB)){if(!fs.existsSync(file)){console.log('missing',file);continue;}const c=retarget(lib2.mesh,file);c.name=name;clips2.push(c);lib2.mesh.skeleton.pose();}
  lib2.mesh.skeleton.pose();lib2.mesh.updateMatrixWorld(true);
  const glb=await new Promise((res,rej)=>new GLTFExporter().parse(lib2.mesh,res,rej,{binary:true,animations:clips2,onlyVisible:true}));
  fs.writeFileSync('arquero_v2.glb',Buffer.from(glb));
  console.log('EXPORT arquero_v2.glb',(glb.byteLength/1024/1024).toFixed(2),'MB clips:',clips2.map(c=>c.name).join(','));
},e=>{console.log('LOAD ERR',e);process.exit(1);});
