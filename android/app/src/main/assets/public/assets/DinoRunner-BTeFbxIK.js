import{C as Dr,R as Xr,r as t,j as r,c as Ur,l as Kr,m as qr,A as Vr,T as Zr,L as Je,f as Jr,n as Qr,v as et,w as rt}from"./index-DcQrm4AF.js";import{p as tt}from"./challengeWinSound-iuwbLf6K.js";import{u as nt,G as ot}from"./GameMuteButton-D6z8IDxN.js";Dr.isNativePlatform()&&Dr.getPlatform();const Qe="20260625-portal-center-entry-fix",J={adventure:{folder:"adventureSprite",runFrames:8,jumpFrames:10,label:"Kaşif",previewSrc:"/DinoRunners/previews/adventure.webp"},dinosour:{folder:"dinosourSprite",runFrames:8,jumpFrames:12,label:"Dinozor",previewSrc:"/DinoRunners/previews/dinosour.webp"},jack:{folder:"jackSprite",runFrames:8,jumpFrames:10,label:"Jack",previewSrc:"/DinoRunners/previews/jack.webp"},robot:{folder:"robotSprite",runFrames:8,jumpFrames:10,label:"Robot",previewSrc:"/DinoRunners/previews/robot.webp"}},Ar=Xr.memo(({character:T,isJumping:j,size:N})=>{const l=J[T],M=t.useRef(null),_=t.useRef([]),z=t.useRef([]),k=t.useRef(1),f=t.useRef(j),h=t.useRef(null),g=Array.from({length:l.runFrames},(s,a)=>a+1),u=Array.from({length:l.jumpFrames},(s,a)=>a+1);t.useEffect(()=>{let s=!1;return[...g.map(p=>`/DinoRunners/${l.folder}/Run (${p}).webp`),...u.map(p=>`/DinoRunners/${l.folder}/Jump (${p}).webp`)].forEach(p=>{var I,ie,he;const b=new Image;b.src=p,(he=(I=b.decode)==null?void 0:(ie=I.call(b)).catch)==null||he.call(ie,()=>{}),s&&(b.src="")}),()=>{s=!0}},[l.folder,l.runFrames,l.jumpFrames]);const m=t.useCallback(()=>{const a=(f.current?z.current:_.current)[k.current-1];!a||a===h.current||(h.current&&(h.current.style.visibility="hidden"),a.style.visibility="visible",h.current=a)},[]);t.useEffect(()=>{f.current!==j&&(f.current=j,k.current=1,m())},[j,m]),t.useEffect(()=>{m();const s=setInterval(()=>{const a=f.current?l.jumpFrames:l.runFrames;k.current=k.current>=a?1:k.current+1,m()},70);return()=>clearInterval(s)},[T,l.jumpFrames,l.runFrames,m]);const d={position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",userSelect:"none",visibility:"hidden",transform:"translateZ(0)",backfaceVisibility:"hidden"};return r.jsxs("div",{ref:M,style:{position:"relative",width:N,height:N,pointerEvents:"none"},children:[g.map((s,a)=>r.jsx("img",{ref:p=>{_.current[a]=p},src:`/DinoRunners/${l.folder}/Run (${s}).webp`,alt:"",draggable:!1,decoding:"sync",style:d},`r${s}`)),u.map((s,a)=>r.jsx("img",{ref:p=>{z.current[a]=p},src:`/DinoRunners/${l.folder}/Jump (${s}).webp`,alt:"",draggable:!1,decoding:"sync",style:d},`j${s}`))]})});Ar.displayName="DinoCharacterSprite";const at=[.03,.15,.35,.6,1],Te=T=>at.map((j,N)=>({src:`/DinoRunners/${T}/${N+1}.webp`,speed:j})),st={level1:[{src:"/DinoRunners/DinoRunnerArkaPlan11/layer07_Sky.webp",speed:.03},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer06_Rocks.webp",speed:.08},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer05_Hills.webp",speed:.18},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer04_Clouds.webp",speed:.12},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer03_Hills_Castle.webp",speed:.3},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer02_Trees_rocks.webp",speed:.55},{src:"/DinoRunners/DinoRunnerArkaPlan11/layer01_Ground.webp",speed:1}],level2:[{src:"/DinoRunners/DinoRunnerArkaPlan22/layer07_Sky.webp",speed:.03},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer06_Rocks.webp",speed:.08},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer05_Clouds.webp",speed:.12},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer04_Hills_2.webp",speed:.22},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer03_Hills_1.webp",speed:.38},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer02_Trees.webp",speed:.6},{src:"/DinoRunners/DinoRunnerArkaPlan22/layer01_Ground.webp",speed:1}],level3:[{src:"/DinoRunners/DinoRunnerArkaPlan33/layer09_Sky.webp",speed:0},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer08_Stars_1.webp",speed:.04},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer07_Stars_2.webp",speed:.07},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer06_Stars_3.webp",speed:.11},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer05_Castle.webp",speed:.25},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer03_Clouds_3.webp",speed:.35},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer02_Clouds_2.webp",speed:.5},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer01_Clouds_1.webp",speed:.7},{src:"/DinoRunners/DinoRunnerArkaPlan33/layer04_Path.webp",speed:1}],level4:[{src:"/DinoRunners/DinoRunnerArkaPlan44/layer06_sky.webp",speed:.03},{src:"/DinoRunners/DinoRunnerArkaPlan44/layer05_rocks.webp",speed:.12},{src:"/DinoRunners/DinoRunnerArkaPlan44/layer04_clouds.webp",speed:.18},{src:"/DinoRunners/DinoRunnerArkaPlan44/layer03_trees.webp",speed:.42},{src:"/DinoRunners/DinoRunnerArkaPlan44/layer02_cake.webp",speed:.65},{src:"/DinoRunners/DinoRunnerArkaPlan44/layer01_ground.webp",speed:1}],level5:Te("DinoRunnerArkaPlan55"),level6:Te("DinoRunnerArkaPlan66"),level7:Te("DinoRunnerArkaPlan77"),level8:Te("DinoRunnerArkaPlan88")},it=({bg:T,speedRef:j,multRef:N})=>{const l=t.useRef(null),M=t.useRef([]),_=t.useRef([]),z=t.useRef([]),k=t.useRef([]),f=st[T];return t.useEffect(()=>{k.current=f.map(()=>({w:0,h:0})),z.current=f.map(()=>0),_.current=f.map(()=>0),f.forEach((u,m)=>{const d=new Image;d.onload=()=>{k.current[m]={w:d.naturalWidth,h:d.naturalHeight},h()},d.src=u.src});const h=()=>{var m;const u=((m=l.current)==null?void 0:m.clientHeight)||window.innerHeight;for(let d=0;d<f.length;d++){const s=k.current[d];s.h>0&&(z.current[d]=s.w*u/s.h)}},g=()=>h();return window.addEventListener("resize",g),()=>window.removeEventListener("resize",g)},[T,f]),t.useEffect(()=>{let h=0,g=performance.now();const u=m=>{const d=Math.min((m-g)/16.6667,3);g=m;const s=j.current*N.current;for(let a=0;a<f.length;a++){const p=z.current[a];let b=_.current[a]+s*f[a].speed*d;p>0&&(b=b%p,b<0&&(b+=p)),_.current[a]=b;const I=M.current[a];I&&(I.style.backgroundPositionX=`${-Math.round(b)}px`)}h=requestAnimationFrame(u)};return h=requestAnimationFrame(u),()=>cancelAnimationFrame(h)},[T,f,j,N]),r.jsx("div",{ref:l,style:{position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden",background:"#000"},children:f.map((h,g)=>r.jsx("div",{ref:u=>{M.current[g]=u},style:{position:"absolute",inset:0,backgroundImage:`url(${h.src})`,backgroundRepeat:"repeat-x",backgroundPosition:"0 bottom",backgroundSize:"auto 100%",willChange:"background-position"}},h.src))})},xt=()=>{const T=Ur(),{requestExit:j,ExitConfirmDialog:N}=Kr(),l=()=>{T(Qr(),{replace:!0})},{hasPlayedToday:M,todayScore:_,leaderboard:z,loading:k,saveScore:f,markAsPlayed:h}=qr("reaktor"),{muted:g,playSound:u}=nt("reaktor"),[m,d]=t.useState(!1),[s,a]=t.useState(null);t.useState(null),t.useState(null),t.useState(null),t.useState(null),t.useState(null);const[p,b]=t.useState(null),[I,ie]=t.useState("level1"),[he,_e]=t.useState(!1),[Fr,er]=t.useState(""),B=t.useRef(null),Ce=t.useRef(1),ge=t.useRef(null),Ne=()=>{try{ge.current||(ge.current=new Audio(`/DinoRunnerPortalGecis.mp3?v=${Qe}`),ge.current.volume=.7);const e=ge.current;e.currentTime=0,e.play().catch(()=>{})}catch{}},Pr={level1:1,level2:1,level3:1,level4:1,level5:1,level6:1,level7:1,level8:1},Me=(e,o)=>Math.min((Pr[e]??1)*(1+(o-1)*.2),4);t.useEffect(()=>{fetch(`/reaktorKosma.json?v=${Qe}`).then(e=>e.json()).then(a).catch(()=>{}),fetch(`/DinoRunnerArkaPlanPortal.json?v=${Qe}`).then(e=>e.json()).then(b).catch(()=>{}),Object.keys(J).forEach(e=>{const o=new Image;o.src=J[e].previewSrc})},[]);const Er=()=>{const e=["linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)","linear-gradient(180deg, #000428 0%, #004e92 100%)","linear-gradient(180deg, #16222A 0%, #3A6073 100%)","linear-gradient(180deg, #134E5E 0%, #71B280 100%)","linear-gradient(180deg, #2C3E50 0%, #FD746C 100%)","linear-gradient(180deg, #403B4A 0%, #E7E9BB 100%)","linear-gradient(180deg, #FF512F 0%, #DD2476 100%)"];return e[Math.floor(Math.random()*e.length)]},[R,ce]=t.useState("waiting"),Tr=()=>j(l,R!=="playing"),[rr,tr]=t.useState(0),[nr,_r]=t.useState(0),[O,Cr]=t.useState(null),[Nr,or]=t.useState(!1),[ar,Mr]=t.useState(!1),[zr,sr]=t.useState([]),[v,ir]=t.useState(1),[ct,cr]=t.useState("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)"),[D,ze]=t.useState({dinoX:50,dinoY:0,dinoRotation:0,dinoOpacity:1,obstacles:[],letters:[],clouds:[],groundOffset:0,portal:null,entryPortal:null}),[me,lr]=t.useState([]),[Ie,Ir]=t.useState(""),[Or,ur]=t.useState(new Set),[dr,pr]=t.useState(""),[Oe,be]=t.useState(null),W=t.useRef("waiting"),X=t.useRef(50),A=t.useRef(0),Le=t.useRef(0),$=t.useRef(0),Y=t.useRef(4),S=t.useRef([]),C=t.useRef([]),Lr=t.useRef([]),U=t.useRef(0),fr=t.useRef(!1),Be=t.useRef(0),We=t.useRef(""),ye=t.useRef(new Set),$e=t.useRef(0),Re=t.useRef([]),K=t.useRef(0),Q=t.useRef(0),ee=t.useRef(0),we=t.useRef(null),ke=t.useRef(0),q=t.useRef(0),ve=t.useRef(),re=t.useRef(0),V=t.useRef(1),le=t.useRef(!1),Ye=t.useRef(750),w=t.useRef(null),Z=t.useRef(null),G=t.useRef(null),ue=t.useRef(0),Ge=t.useRef(2),He=t.useRef(null),de=300,Se=24,xr=.63,hr=-de*xr,te=4,Xe=180,gr=["🫵","Süper","Çok iyi!","👏","👌","Güzel","👍","💯","İyi","🤙"],Br=.6,Wr=10,pe=600,fe=350,ne=30,mr=50,L=40,oe=40,Ue=30,ae=35,Ke=e=>e<=1?"level1":e===2?"level2":e===3?"level3":e===4?"level4":e===5?"level5":e===6?"level6":e===7?"level7":"level8",br=(e=V.current)=>{const o=Ke(e);B.current&&B.current.setSpeed(Me(o,e)),Ce.current=1},$r=(e,o)=>{const y=pe,Ae=Math.max(1,y-o),P=1-Math.min(Math.max((y-e)/Ae,0),1);if(Ce.current=P,B.current){const Fe=Me(Ke(V.current),V.current);B.current.setSpeed(Fe*P)}};t.useEffect(()=>{fetch("/wordlist.txt").then(e=>e.text()).then(e=>lr(e.split(`
`).map(o=>o.trim().toUpperCase()).filter(o=>o.length>=6&&o.length<=8))).catch(()=>lr(["REAKTÖR","FİSYON","URANYUM","KARBON","PLUTONYUM"]))},[]),t.useEffect(()=>{We.current=Ie},[Ie]),t.useEffect(()=>{fr.current=ar},[ar]),t.useEffect(()=>{Mr(g)},[g]),t.useEffect(()=>{V.current=v},[v]);const se=(e,o="sine",y=.1)=>{fr.current||et(e,o,y)},qe=t.useCallback(()=>{if(me.length===0)return;const e=me[Math.floor(Math.random()*me.length)];Ir(e),ur(new Set),ye.current=new Set,pr(`HEDEF: ${e}`),setTimeout(()=>pr(""),2e3),We.current=e,Q.current=0,q.current=Date.now()+1e3},[me]),yr=e=>{if(e){const o=gr[Math.floor(Math.random()*gr.length)];be({text:o,type:"success"}),se(800,"square",.2)}else be({text:"Olmadı!",type:"fail"}),se(150,"sawtooth",.3);setTimeout(()=>be(null),1500)},je=t.useRef(!1),Ve=t.useRef(!0);t.useEffect(()=>{je.current=M},[M]),t.useEffect(()=>{Ve.current=k},[k]);const Rr=()=>{if(Ve.current||je.current)return;je.current=!0,h(),W.current="playing",X.current=te,Le.current=0,$.current=0,Y.current=2,U.current=0,re.current=0,tr(0),ir(1),V.current=1,$e.current=0,cr("linear-gradient(180deg, #1a2a6c 0%, #b21f1f 100%)"),B.current&&B.current.setSpeed(1),ie("level1"),le.current=!1,Ye.current=750,w.current=null,ue.current=0,Z.current={x:hr};const e=fe/2-oe/2-ne+Xe;A.current=e,G.current={startTime:performance.now(),fromX:te,toX:mr,fromY:e,toY:0,duration:1400},He.current&&clearTimeout(He.current),_e(!1),er(""),Re.current=[],sr([]),K.current=0,S.current=[],we.current=null,ke.current=0,C.current=[],Lr.current=[],ze({dinoX:te,dinoY:e,dinoRotation:0,dinoOpacity:0,obstacles:[],letters:[],clouds:[],groundOffset:0,portal:null,entryPortal:Z.current}),be(null),ee.current=Date.now()+1800,qe(),Ne(),se(440,"triangle"),ce("playing")},Yr=e=>{u("buttonClick"),Ne();const o=Ke(e);ie(o),ir(e),V.current=e,$e.current=0,br(e),cr(Er()),S.current=[],C.current=[],we.current=null,ke.current=0,w.current=null,le.current=!1,ue.current=0,Z.current={x:hr},X.current=te;const y=fe/2-oe/2-ne+Xe;A.current=y,$.current=0,G.current={startTime:performance.now(),fromX:te,toX:mr,fromY:y,toY:0,duration:1400},ee.current=Date.now()+1800,q.current=Date.now()+1400,re.current=0,ze(F=>({...F,dinoX:te,dinoY:y,dinoOpacity:0,obstacles:[],letters:[],portal:null,entryPortal:Z.current})),qe(),W.current="playing",ce("playing")};t.useEffect(()=>{if(!B.current)return;const e=requestAnimationFrame(()=>{var o;(o=B.current)==null||o.setSpeed(Me(I,v))});return()=>cancelAnimationFrame(e)},[I,v]);const De=e=>{if(e&&(e.preventDefault(),e.stopPropagation()),W.current==="playing"&&($.current=Wr,!g)){const o=()=>rt();typeof requestAnimationFrame=="function"?requestAnimationFrame(()=>setTimeout(o,0)):setTimeout(o,0)}},wr=(e,o)=>e.x<o.x+o.width&&e.x+e.width>o.x&&e.y<o.y+o.height&&e.y+e.height>o.y,kr=e=>{if(W.current!=="playing")return;const o=e||performance.now();re.current===0&&(re.current=o);const y=o-re.current;re.current=o;const F=Math.min(y,50)/16.667;if(G.current||($.current-=Br*F,A.current+=$.current*F,A.current<=0&&(A.current=0,$.current=0),A.current>fe-oe&&(A.current=fe-oe,$.current=-2)),Le.current+=Y.current*4*F,Y.current+=.001*F,G.current){const n=G.current,i=Math.min((o-n.startTime)/n.duration,1),c=1-Math.pow(1-i,3);X.current=n.fromX+(n.toX-n.fromX)*c,A.current=n.fromY+(n.toY-n.fromY)*c,i>=1&&(X.current=n.toX,A.current=n.toY,$.current=0,G.current=null,Z.current=null)}Be.current=(Be.current+Y.current*F)%40;const Ae={x:X.current+5,y:A.current+5,width:L-10,height:oe-10};for(let n=S.current.length-1;n>=0;n--)S.current[n].x-=Y.current*F,S.current[n].x<=-Ue&&S.current.splice(n,1);if(Date.now()>ee.current){const n=we.current,i=ke.current;let c;n&&i>=2?c=n!=="ceiling":n&&i===1?c=n==="ceiling"?Math.random()<.25:Math.random()<.75:c=Math.random()<.45;const H=c?"ceiling":"ground";if(ke.current=n===H?i+1:1,we.current=H,c){const x=20+Math.floor(Math.random()*111);S.current.push({id:Math.random(),x:pe,y:fe-ne-x,width:Ue,height:x,type:"ceiling"})}else{const x=20+Math.floor(Math.random()*111),E=x<=45?"short":x>=100?"tall":"box";S.current.push({id:Math.random(),x:pe,y:0,width:Ue,height:x,type:E})}ee.current=Date.now()+1e3+Math.random()*1500}for(let n of S.current){const i={x:n.x+5,y:n.y,width:n.width-10,height:n.height-5};if(wr(Ae,i)){ce("gameOver"),W.current="gameOver",se(150,"sawtooth",.5);const c=Math.floor(U.current),H=K.current,x=c+H;tr(x),x>nr&&_r(x),g||tt(),f(x,Re.current.length).then(E=>{E&&Jr.success(`🎯 Challenge puanın kaydedildi: ${x}`)});return}}const vr=Math.floor(U.current)+K.current;if(!le.current&&!w.current&&vr>=Ye.current){le.current=!0;const n=V.current+1;S.current=[],C.current=[],ee.current=Date.now()+5e3,q.current=Date.now()+5e3,setTimeout(()=>{W.current==="playing"&&(w.current={x:pe,targetLevel:n})},900)}if(w.current){w.current.x-=Y.current*F;const n=w.current.x+de*xr,i=X.current+L/2;$r(n,i);const c=n-L/2,H=n+L,x=Math.max(1,H-c);if(ue.current=Math.min(Math.max((i-c)/x,0),1),i>=n+L){const E=w.current.targetLevel;w.current=null,Ne(),Ge.current=E,Ye.current+=750,W.current="transition",ce("transition"),er(`🎉 Tebrikler ${E}. Levele geçtiniz!`),_e(!0),se(900,"sine",.3),He.current=setTimeout(()=>{_e(!1),ce("levelStart")},2200);return}else w.current.x<-de&&(w.current=null,le.current=!1,br())}for(let n=C.current.length-1;n>=0;n--)C.current[n].x-=Y.current*F,C.current[n].x<=-ae&&C.current.splice(n,1);const P=We.current;if(P&&Q.current<P.length&&Date.now()>q.current){const n=P[Q.current],i=pe,c=80,H=S.current.filter(Ee=>Ee.x+Ee.width+c>i-ae&&Ee.x<i+ae+c),x=ee.current-Date.now();let E=!1;x>=0&&x<350&&(q.current=Date.now()+400,E=!0);let xe=0,Sr=!1;if(!E){xe=30+Math.random()*150;for(let jr=0;jr<20;jr++){if(!H.some(Ze=>xe<Ze.y+Ze.height+6&&xe+ae+6>Ze.y)){Sr=!0;break}xe=30+Math.random()*150}Sr||(q.current=Date.now()+300,E=!0)}E||(C.current.push({id:Math.random(),x:i,y:xe,char:n,indexInWord:Q.current,width:ae,height:ae,collected:!1}),Q.current++,q.current=Date.now()+800+Math.random()*600)}C.current.forEach(n=>{if(n.collected)return;const i={x:n.x-15,y:n.y-15,width:n.width+30,height:n.height+30};if(wr(Ae,i)){n.collected=!0,se(1e3,"square",.1),U.current+=10;const c=new Set(ye.current);c.add(n.indexInWord),ye.current=c,ur(new Set(c))}});const Fe=C.current.filter(n=>!n.collected);P&&Q.current>=P.length&&Fe.length===0&&(ye.current.size===P.length?(Re.current.push(P),K.current+=P.length*10,sr([...Re.current]),yr(!0),$e.current+=1):yr(!1),qe());let Pe=1;if(G.current){const n=G.current,i=Math.min((performance.now()-n.startTime)/n.duration,1);Pe=Math.min(1,i*1.2)}ue.current>0&&(Pe=Math.min(Pe,1-ue.current)),ze({dinoX:X.current,dinoY:A.current,dinoRotation:Le.current,dinoOpacity:Pe,obstacles:S.current,letters:Fe,clouds:[],groundOffset:Be.current,portal:w.current?{x:w.current.x}:null,entryPortal:Z.current?{x:Z.current.x}:null}),ve.current=requestAnimationFrame(kr)};t.useEffect(()=>(R==="playing"&&(ve.current=requestAnimationFrame(kr)),()=>{ve.current&&cancelAnimationFrame(ve.current)}),[R]),t.useEffect(()=>{const e=o=>{(o.code==="Space"||o.code==="ArrowUp")&&De(o)};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[R]);const Gr=Math.floor(U.current)+K.current,Hr=R==="gameOver"?rr:Gr;return r.jsxs("div",{className:"page-wrapper",children:[r.jsxs("div",{className:"game-container",children:[r.jsxs("div",{className:"top-bar",children:[r.jsxs("button",{onClick:()=>{u("buttonClick"),Tr()},className:"icon-btn",children:[r.jsx(Vr,{size:24}),r.jsx("span",{className:"btn-text",children:"GERİ"})]}),r.jsxs("div",{className:"score-board",children:[r.jsxs("div",{className:"score-item",children:[r.jsx("span",{className:"label",children:"SEVİYE"}),r.jsx("span",{className:"value",children:v})]}),r.jsxs("div",{className:"score-item",children:[r.jsx("span",{className:"label",children:"PUAN"}),r.jsx("span",{className:"value",children:Hr})]}),r.jsxs("div",{className:"score-item",children:[r.jsx("span",{className:"label",children:"REKOR"}),r.jsx("span",{className:"value",children:nr})]})]}),r.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8},children:[r.jsx(ot,{gameId:"reaktor",size:40}),r.jsx("button",{onClick:()=>{u("buttonClick"),d(!0)},className:"icon-btn",title:"Sıralamalar",children:r.jsx(Zr,{size:24})})]})]}),r.jsxs("div",{className:"game-stage","data-no-sfx":!0,onPointerDown:De,style:{background:"transparent"},children:[r.jsx(it,{bg:I,speedRef:Y,multRef:Ce}),D.entryPortal&&p&&r.jsx("div",{style:{position:"absolute",left:0,top:-Se-Xe,width:de,height:`calc(100% + ${Se*2}px)`,transform:`translate3d(${D.entryPortal.x}px, 0, 0)`,zIndex:6,pointerEvents:"none"},children:r.jsx(Je,{animationData:p,loop:!0,autoplay:!0,style:{width:"100%",height:"100%"},rendererSettings:{preserveAspectRatio:"none"}})}),D.portal&&p&&r.jsx("div",{style:{position:"absolute",left:0,top:-Se,width:de,height:`calc(100% + ${Se*2}px)`,transform:`translate3d(${D.portal.x}px, 0, 0)`,zIndex:6,pointerEvents:"none"},children:r.jsx(Je,{animationData:p,loop:!1,autoplay:!0,style:{width:"100%",height:"100%"},rendererSettings:{preserveAspectRatio:"none"}})}),he&&r.jsx("div",{className:"level-up-banner",children:Fr}),Oe&&r.jsx("div",{className:`feedback-popup ${Oe.type}`,children:Oe.text}),D.letters.map(e=>r.jsx("div",{className:"letter-box",style:{width:e.width,height:e.height,transform:`translate3d(${e.x}px, ${-(e.y+ne)}px, 0)`},children:r.jsx("div",{className:`letter-inner ${v===2?"neon-pink":v===3?"neon-green":v===4?"neon-blue":v===5?"letter-black":v===6?"letter-purple":v===7?"letter-red":v===8?"letter-blue":""}`,children:e.char})},e.id)),D.obstacles.map(e=>r.jsx("div",{className:`obstacle obs-${e.type}`,style:{width:e.width,height:e.height,transform:`translate3d(${e.x}px, ${-(e.y+ne)}px, 0)`}},e.id)),r.jsx("div",{className:"reactor",style:{width:L,height:oe,opacity:D.dinoOpacity,transform:`translate3d(${D.dinoX}px, ${-(D.dinoY+ne)}px, 0)${O?"":` rotate(${D.dinoRotation}deg)`}`},children:O?r.jsx("div",{style:{position:"absolute",left:"50%",bottom:0,transform:"translateX(-50%)",width:L*2.5,height:L*2.5,pointerEvents:"none"},children:r.jsx(Ar,{character:O,isJumping:D.dinoY>2,size:L*2.5})}):"☢️"}),r.jsx("div",{className:"ground"}),r.jsx("div",{className:"hud",children:dr?r.jsx("div",{className:"notification",children:dr}):r.jsx("div",{className:"word-display",children:Ie.split("").map((e,o)=>{const y=Or.has(o);return r.jsx("span",{className:`char-slot ${y?"found":""}`,children:e},o)})})}),(R==="waiting"||R==="gameOver")&&r.jsx("div",{className:"overlay",children:r.jsxs("div",{className:"card",children:[R==="waiting"&&s&&r.jsx("div",{style:{width:100,height:100,margin:"0 auto 8px"},children:r.jsx(Je,{animationData:s,loop:!0,autoplay:!0,style:{width:"100%",height:"100%"}})}),r.jsx("h2",{children:R==="waiting"?"HARF KOŞUSU":"SİSTEM ÇÖKTÜ!"}),R==="gameOver"?r.jsxs("div",{children:[r.jsxs("p",{children:["Mesafe Puanı: ",Math.floor(U.current/5)]}),zr.length>0&&r.jsxs("p",{children:["Kelime Bonusu: +",K.current]}),r.jsxs("p",{style:{fontSize:"20px",fontWeight:"bold",color:"#FFD700",marginTop:"8px"},children:["Toplam: ",rr]}),_!==null&&r.jsxs("p",{style:{fontSize:"12px",color:"#aaa",marginTop:"4px"},children:["Bugünkü en iyi: ",_]})]}):M?r.jsxs("div",{children:[r.jsx("p",{style:{color:"#aaa",marginBottom:"8px"},children:"Bugünkü challenge tamamlandı! ✅"}),r.jsxs("p",{style:{fontSize:"20px",fontWeight:"bold",color:"#FFD700"},children:["Puanın: ",_]}),r.jsx("p",{style:{fontSize:"12px",color:"#888",marginTop:"8px"},children:"Yarın tekrar dene 🎯"}),r.jsxs("div",{style:{marginTop:"10px",background:"rgba(255,165,0,0.15)",border:"1px solid rgba(255,165,0,0.3)",borderRadius:"8px",padding:"8px 12px"},children:[r.jsx("p",{style:{fontSize:"12px",color:"#FFD700",fontWeight:"bold"},children:"🏆 1. Lik Ödülü"}),r.jsx("p",{style:{fontSize:"14px",color:"#fff",marginTop:"4px"},children:"📄 3 Oyun Sayfası"})]})]}):r.jsxs("div",{children:[r.jsx("p",{children:"Harfleri topla, engellerden kaç!"}),r.jsxs("div",{style:{marginTop:"10px",background:"rgba(255,165,0,0.15)",border:"1px solid rgba(255,165,0,0.3)",borderRadius:"8px",padding:"8px 12px"},children:[r.jsx("p",{style:{fontSize:"12px",color:"#FFD700",fontWeight:"bold"},children:"🏆 1. Lik Ödülü"}),r.jsx("p",{style:{fontSize:"14px",color:"#fff",marginTop:"4px"},children:"📄 3 Oyun Sayfası"})]})]}),!M&&r.jsx("button",{className:"start-btn",onClick:e=>{e.stopPropagation(),u("buttonClick"),R==="waiting"&&!O?or(!0):Rr()},children:R==="waiting"?O?"BAŞLA":"GİRİŞ":"TEKRAR DENE"})]})}),Nr&&r.jsx("div",{className:"overlay",onClick:e=>e.stopPropagation(),children:r.jsxs("div",{className:"card character-picker-card",children:[r.jsx("h2",{style:{marginBottom:6},children:"KARAKTER SEÇ"}),r.jsx("p",{style:{fontSize:12,color:"#aaa",marginBottom:8},children:"Bir karakter seç ve BAŞLA'ya bas"}),r.jsx("div",{className:"character-grid",children:Object.keys(J).map(e=>{const o=O===e;return r.jsxs("button",{onClick:y=>{y.stopPropagation(),Cr(e)},style:{background:o?"rgba(0,234,255,0.15)":"rgba(255,255,255,0.05)",border:o?"2px solid #00eaff":"2px solid rgba(255,255,255,0.1)",borderRadius:12,padding:8,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,color:"#fff"},children:[r.jsx("img",{src:J[e].previewSrc,alt:J[e].label,draggable:!1,loading:"eager",decoding:"async",style:{width:58,height:58,objectFit:"contain"}}),r.jsx("span",{style:{fontSize:13,fontWeight:"bold"},children:J[e].label})]},e)})}),r.jsx("button",{className:"start-btn",style:{marginTop:8,opacity:O?1:.5},disabled:!O,onClick:e=>{e.stopPropagation(),O&&(u("buttonClick"),or(!1),!je.current&&!Ve.current&&W.current!=="playing"&&Rr())},children:"BAŞLA"})]})}),R==="levelStart"&&r.jsx("div",{className:"overlay",children:r.jsxs("div",{className:"card",children:[r.jsxs("h2",{children:[Ge.current,". LEVEL AÇILDI!"]}),r.jsx("p",{children:"Portaldan geçtin, yeni bölge seni bekliyor."}),r.jsx("div",{style:{marginTop:"10px",background:"rgba(0,234,255,0.12)",border:"1px solid rgba(0,234,255,0.35)",borderRadius:"8px",padding:"8px 12px"},children:r.jsxs("p",{style:{fontSize:"12px",color:"#00eaff",fontWeight:"bold"},children:["Mevcut Puanın: ",Math.floor(U.current)+K.current]})}),r.jsx("button",{className:"start-btn",onClick:e=>{e.stopPropagation(),Yr(Ge.current)},children:"BAŞLA"})]})})]}),r.jsxs("div",{className:"mobile-controls",children:[r.jsx("button",{className:"control-btn","data-no-sfx":!0,onPointerDown:e=>De(e),children:"ZIPLA ↰"}),r.jsx("button",{className:"control-btn","data-no-sfx":!0,onPointerDown:e=>De(e),children:"ZIPLA ↱"})]})]}),m&&r.jsx("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"},onClick:()=>d(!1),children:r.jsxs("div",{style:{background:"#1a1a2e",borderRadius:"20px",padding:"24px",maxWidth:"400px",width:"100%",maxHeight:"80vh",overflow:"auto",border:"1px solid rgba(255,255,255,0.1)"},onClick:e=>e.stopPropagation(),children:[r.jsxs("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"},children:[r.jsx("h3",{style:{color:"white",fontSize:"18px",fontWeight:"bold"},children:"🏆 Günlük Sıralama"}),r.jsx("button",{onClick:()=>{u("buttonClick"),d(!1)},style:{background:"rgba(255,255,255,0.1)",border:"none",color:"white",borderRadius:"8px",padding:"6px 12px",cursor:"pointer"},children:"✕"})]}),z.length===0?r.jsx("p",{style:{color:"#888",textAlign:"center",padding:"20px"},children:"Henüz kimse oynamamış"}):z.map((e,o)=>r.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"12px",padding:"10px",borderRadius:"12px",background:o===0?"rgba(255,215,0,0.1)":"rgba(255,255,255,0.05)",marginBottom:"8px",border:o===0?"1px solid rgba(255,215,0,0.3)":"1px solid transparent"},children:[r.jsx("span",{style:{width:"24px",textAlign:"center",fontWeight:"bold",color:o===0?"#FFD700":o===1?"#C0C0C0":o===2?"#CD7F32":"#888",fontSize:"14px"},children:o+1}),r.jsx("div",{style:{width:"32px",height:"32px",borderRadius:"50%",background:"rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"},children:e.avatar_url?r.jsx("img",{src:e.avatar_url,style:{width:"100%",height:"100%",objectFit:"cover"}}):r.jsx("span",{style:{fontSize:"14px"},children:"👤"})}),r.jsx("div",{style:{flex:1},children:r.jsx("span",{style:{color:"white",fontSize:"13px",fontWeight:"600"},children:e.username})}),r.jsx("span",{style:{color:"#FFD700",fontWeight:"bold",fontSize:"14px"},children:e.score})]},e.id))]})}),r.jsx("style",{children:`
        /* Sayfa Geneli */
        .page-wrapper {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #141E30 0%, #243B55 100%);
            padding: 20px;
            box-sizing: border-box;
        }

        .game-container {
            width: 100%;
            max-width: 600px;
            font-family: 'Segoe UI', sans-serif; user-select: none;
            position: relative;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border-radius: 12px;
            overflow: hidden;
        }
        
        .top-bar {
            display: flex;
            justify-content: space-between; align-items: center;
            padding: 12px 20px;
            color: #fff;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid rgba(255,255,255,0.1);
            position: relative; z-index: 20;
        }
        
        .icon-btn {
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2); 
            color: white; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            padding: 8px; border-radius: 8px; gap: 6px;
            transition: all 0.2s; min-width: 44px;
        }
        .icon-btn:hover { background: rgba(255,255,255,0.2); }
        .icon-btn:active { transform: scale(0.95); }
        .btn-text { font-weight: bold; font-size: 14px; display: none; }
        @media(min-width: 400px) { .btn-text { display: inline; } }

        .score-board { display: flex; gap: 15px; }
        .score-item { display: flex; flex-direction: column; align-items: center; }
        .score-item .label { font-size: 9px; color: #aaa; font-weight: bold; letter-spacing: 1px; }
        .score-item .value { font-size: 16px; font-weight: bold; font-family: monospace; color: #FFD700; }

        .game-stage {
            position: relative;
            width: 100%; height: 350px;
            background: transparent;
            overflow: hidden; cursor: pointer;
            border: 2px solid rgba(255,255,255,0.1);
            border-top: none;
            border-bottom: none;
        }

        .mobile-controls {
            display: flex;
            background: #111;
            padding: 15px;
            gap: 15px;
            border-top: 1px solid rgba(255,255,255,0.1);
        }
        
        .control-btn {
            flex: 1;
            background: linear-gradient(180deg, #333 0%, #111 100%);
            color: #fff;
            border: 1px solid #444;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            box-shadow: 0 4px 0 #000;
            transition: all 0.1s;
            touch-action: manipulation;
        }
        
        .control-btn:active {
            transform: translateY(4px);
            box-shadow: 0 0 0 #000;
            background: linear-gradient(180deg, #222 0%, #000 100%);
            border-color: #666;
        }

        .reactor {
            position: absolute;
            left: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
            z-index: 10;
            color: #00ff00;
        }
        .obstacle {
            position: absolute;
            left: 0;
            bottom: 0;
            border-radius: 4px;
            border: 2px solid rgba(255, 255, 255, 0.9);
        }
        .obs-short {
            background: #5cb85c;
        }
        .obs-tall {
            background: #2e7d32;
        }
        .obs-box {
            background: #00d2d3;
            border-radius: 6px;
        }
        .obs-ceiling {
            background: linear-gradient(180deg, #ff4444 0%, #8b0000 100%);
            border-radius: 0 0 6px 6px;
        }

        .letter-box {
            position: absolute;
            left: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 5;
        }
        .letter-inner {
            width: 32px;
            height: 32px;
            background: #FFD700;
            border-radius: 50%;
            color: #222;
            display: flex; align-items: center;
            justify-content: center;
            font-weight: 900;
            font-size: 18px; font-family: 'Arial Black', sans-serif;
        }
        .letter-inner.neon-green {
            background: #39FF14;
            box-shadow: 0 0 8px rgba(57, 255, 20, 0.7);
        }
        .letter-inner.neon-pink {
            background: #FF10F0;
            box-shadow: 0 0 8px rgba(255, 16, 240, 0.7);
        }
        .letter-inner.neon-blue {
            background: #00F0FF;
            box-shadow: 0 0 8px rgba(0, 240, 255, 0.7);
        }
        .letter-inner.letter-black {
            background: #111;
            color: #fff;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.7);
        }
        .letter-inner.letter-purple {
            background: #9D00FF;
            color: #fff;
            box-shadow: 0 0 8px rgba(157, 0, 255, 0.7);
        }
        .letter-inner.letter-red {
            background: #FF2222;
            color: #fff;
            box-shadow: 0 0 8px rgba(255, 34, 34, 0.7);
        }
        .letter-inner.letter-blue {
            background: #0066FF;
            color: #fff;
            box-shadow: 0 0 8px rgba(0, 102, 255, 0.7);
        }

        .ground {
            position: absolute;
            bottom: 0; left: 0; width: 100%;
            height: 30px;
            background: #222;
            border-top: 2px solid #555;
        }

        .hud {
            position: absolute;
            top: 15px; left: 0; width: 100%;
            display: flex; justify-content: center; pointer-events: none;
            padding: 0 10px; box-sizing: border-box;
        }
        
        .word-display {
            background: rgba(0,0,0,0.7);
            padding: 8px 12px;
            border-radius: 30px; border: 1px solid rgba(255,255,255,0.3);
            display: flex; flex-wrap: wrap; justify-content: center; gap: 4px;
            align-items: center;
            
            max-width: 100%;
        }

        .char-slot {
            font-size: 20px;
            font-weight: bold; color: #666;
            min-width: 15px; text-align: center; font-family: monospace;
            border-bottom: 2px solid #444;
        }
        
        @media (max-width: 400px) {
            .char-slot { font-size: 16px; border-bottom-width: 1px; }
            .word-display { gap: 2px; padding: 6px 10px; }
        }

        .char-slot.found { color: #00ff00; border-color: #00ff00; text-shadow: 0 0 10px #00ff00; transform: scale(1.1); transition: all 0.2s; }
        
        .notification {
            font-size: 28px;
            font-weight: bold; color: #fff;
            text-shadow: 0 0 20px #ff00de; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        }

        .feedback-popup {
            position: absolute;
            top: 40%; left: 50%; transform: translate(-50%, -50%);
            font-size: 40px; font-weight: 900; z-index: 40;
            text-align: center; white-space: nowrap;
            animation: bounceIn 0.5s ease-out forwards, fadeOut 0.5s ease-in 1s forwards;
        }
        .feedback-popup.success {
            color: #FFD700;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.8), 2px 2px 0 #000;
            background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 15px;
        }
        .feedback-popup.fail {
            color: #FF4444;
            text-shadow: 0 0 10px rgba(255, 68, 68, 0.8), 2px 2px 0 #000;
            background: rgba(0,0,0,0.3); padding: 10px 20px; border-radius: 15px;
        }

        @keyframes bounceIn {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes fadeOut { to { opacity: 0; transform: translate(-50%, -60%) scale(1.1); } }
        @keyframes popIn { from { transform: scale(0); } to { transform: scale(1); } }

        .level-up-banner {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0);
            z-index: 61;
            /* 🔥 Küçük ekranlarda (iOS native) taşmayı önle: viewport'a göre ölçekle */
            font-size: clamp(14px, 4.6vw, 24px);
            line-height: 1.25;
            font-weight: 900;
            text-align: center;
            color: #fff;
            text-shadow: 0 0 10px #00eaff, 0 0 25px #00eaff, 2px 2px 0 #000;
            background: rgba(0,0,0,0.55);
            padding: 12px 16px;
            border-radius: 18px;
            border: 2px solid rgba(0,234,255,0.6);
            /* nowrap taşmaya sebep oluyordu → satır kırılmasına izin ver */
            white-space: normal;
            word-break: break-word;
            width: max-content;
            max-width: min(78%, 300px);
            box-sizing: border-box;
            animation:
              levelUpGrow 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards,
              levelUpPulse 0.9s ease-in-out 0.6s infinite;
        }
        @keyframes levelUpGrow {
            0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            60% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        @keyframes levelUpPulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.04); }
        }

        @media (max-width: 400px) {
            .level-up-banner { font-size: 17px; padding: 12px 16px; }
        }

        .overlay {
            position: absolute;
            inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center; z-index: 50; backdrop-filter: blur(5px);
        }
        .card {
            background: #222;
            color: #fff; padding: 30px; border-radius: 20px;
            text-align: center; border: 1px solid #444; box-shadow: 0 0 50px rgba(0,0,0,0.6);
            max-width: calc(100% - 32px);
            max-height: calc(100% - 32px);
            overflow: auto;
            box-sizing: border-box;
        }
        .character-picker-card {
            width: min(420px, calc(100% - 18px));
            max-height: calc(100% - 18px);
            padding: 14px;
            overflow: hidden;
            box-sizing: border-box;
        }
        .character-picker-card h2 {
            font-size: 20px;
            line-height: 1.1;
        }
        .character-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        .start-btn {
            background: linear-gradient(45deg, #FFD700, #FF8C00);
            border: none; padding: 12px 30px; color: #000; font-weight: 900;
            font-size: 18px; border-radius: 30px; margin-top: 15px; cursor: pointer;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.4); transition: transform 0.1s;
        }
        .character-picker-card .start-btn {
            width: 100%;
            min-height: 40px;
            padding: 9px 20px;
            font-size: 16px;
        }
        .start-btn:active { transform: scale(0.95); }
      `}),N]})};export{xt as default};
