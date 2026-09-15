import{c as ue,d as pe,r as o,j as s,A as ge}from"./index-DcQrm4AF.js";const xe=()=>{const X=ue(),{playSound:Z}=pe(),[d,u]=o.useState("waiting"),[z,T]=o.useState([]),[F,k]=o.useState([]),[b,L]=o.useState(0),[ee,x]=o.useState(null),[v,W]=o.useState(1),[A,te]=o.useState(!0),[G,se]=o.useState(!0),[m,H]=o.useState([]),[y,Y]=o.useState(""),[E,M]=o.useState(new Set),[J,S]=o.useState(!1),[q,h]=o.useState(""),[f,$]=o.useState({}),[p,O]=o.useState(10),[j,B]=o.useState({show:!1,title:"",message:"",type:"info"}),g=o.useRef(null),R=16;o.useEffect(()=>{(async()=>{try{const a=(await(await fetch("/wordlist.txt")).text()).split(`
`).map(r=>r.trim().toUpperCase()).filter(r=>r.length>=4&&r.length<=16);H(a)}catch(e){console.log("Kelime listesi yüklenemedi:",e),H(["KEDI","KALEM","BILGISAYAR","TEKNOLOJI","PROGRAMLAMA","OYUN","MASA","KITAP"])}})()},[]),o.useEffect(()=>{if(!g.current){const n=window.AudioContext||window.webkitAudioContext;g.current=new n}return()=>{g.current&&(g.current.close(),g.current=null)}},[]);const D=(n,e,t="info")=>{B({show:!0,title:n,message:e,type:t})},V=()=>{B({...j,show:!1}),p<=0&&u("gameOver")},ne=()=>{Z("buttonClick"),X("/")},l=o.useCallback((n,e=200)=>{if(!(!A||!g.current))try{const t=g.current,a=t.createOscillator(),r=t.createGain();a.connect(r),r.connect(t.destination),a.frequency.value=n,a.type="sine",r.gain.setValueAtTime(.3,t.currentTime),r.gain.exponentialRampToValueAtTime(.01,t.currentTime+e/1e3),a.start(t.currentTime),a.stop(t.currentTime+e/1e3)}catch(t){console.log("Ses çalınamadı:",t)}},[A]),c=o.useCallback((n=[100])=>{if(G)try{navigator.vibrate&&navigator.vibrate(n)}catch(e){console.log("Titreşim çalışmadı:",e)}},[G]),P=o.useCallback(n=>200+n*50,[]),w=o.useCallback(()=>Math.floor(Math.random()*R),[]),I=o.useCallback(n=>Math.min(3+n,16),[]),K=o.useCallback(n=>{if(m.length===0)return"OYUN";const e=m.filter(a=>a.length===n);if(e.length>0)return e[Math.floor(Math.random()*e.length)];const t=m.filter(a=>a.length>=n-1&&a.length<=n+1);return t.length>0?t[Math.floor(Math.random()*t.length)]:m[Math.floor(Math.random()*m.length)]},[m]),U=o.useCallback(n=>{const e={},t=n.length,r=Array.from({length:R},(i,N)=>N).sort(()=>Math.random()-.5);for(let i=0;i<t;i++)e[r[i]]=n[i];for(let i=t;i<R;i++)e[r[i]]=null;return e},[]),ae=o.useCallback(()=>{const n=w(),e=I(1),t=K(e),a=U(t);Y(t),$(a),T([n]),k([]),L(0),W(1),O(10),M(new Set),u("showing"),S(!1),h(""),l(440,300),c([200]),C([n])},[w,I,K,U,l,c]),C=o.useCallback(n=>{let e=0;x(null);const t=()=>{if(e<n.length){const a=n[e];x(a),M(r=>{const i=new Set(r);return i.add(a),i}),l(P(a),300),c([50]),setTimeout(()=>{x(null),setTimeout(()=>{e++,t()},100)},400)}else setTimeout(()=>{u("playing"),l(880,200)},300)};setTimeout(t,500)},[l,P,c]),oe=o.useCallback(n=>{if(d!=="playing")return;const e=[...F,n];k(e),x(n),l(P(n),150),c([30]),setTimeout(()=>x(null),150);const t=e.length-1;if(e[t]!==z[t]){u("gameOver"),l(150,500),c([200,100,200]);return}if(e.length===z.length){const a=b+v*10;L(a),l(660,200),setTimeout(()=>l(880,200),100),c([100,50,100]),setTimeout(()=>{const r=[...z,w()];T(r),k([]),u("showing"),C(r)},600)}},[d,F,z,b,v,w,C,l,P,c]),re=o.useCallback(()=>{const n=q.trim().toUpperCase(),e=y.toUpperCase();if(n===e){const a=100+(Object.values(f).filter(N=>N!==null).length-E.size)*10,r=b+a,i=v+1;L(r),W(i),O(10),l(1200,300),setTimeout(()=>l(1400,300),150),c([100,50,100,50,100]),D("🎉 Mükemmel!",`Doğru bildin! +${a} puan!`,"success"),setTimeout(()=>{V();const N=I(i),_=K(N),de=U(_),Q=w();Y(_),$(de),T([Q]),k([]),M(new Set),S(!1),h(""),u("showing"),C([Q])},2e3)}else{const t=p-1;O(t),h(""),t>0?(l(150,500),c([200,100,200]),D("❌ Yanlış Cevap",`Dikkat et! Kalan Hakkın: ${t}`,"error")):(l(100,800),c([500]),D("💀 Oyun Bitti","Tahmin hakkın kalmadı!","error"))}},[q,y,b,E,v,f,p,l,c,I,K,U,w,C]),ie=o.useCallback(()=>{u("waiting"),T([]),k([]),L(0),W(1),O(10),x(null),M(new Set),Y(""),$({}),S(!1),h(""),B({show:!1,title:"",message:"",type:"info"})},[]),le=()=>{const n=y.split(""),e=new Set;return Object.entries(f).forEach(([t,a])=>{a&&E.has(parseInt(t))&&e.add(a)}),s.jsx("div",{className:"word-display",children:n.map((t,a)=>{const r=e.has(t);return s.jsx("span",{className:`word-letter ${r?"revealed":""}`,children:r?t:"?"},a)})})},ce=()=>{const n=[];for(let e=0;e<R;e++){const t=ee===e,a=d==="playing",r=E.has(e),i=f[e]!==null&&f[e]!==void 0;n.push(s.jsx("button",{className:`grid-cell ${t?"active":""} ${a?"clickable":""}`,onClick:()=>oe(e),disabled:!a,children:r&&i&&s.jsx("span",{className:"cell-letter",children:f[e]})},e))}return n};return s.jsxs("div",{className:"simon-game",children:[s.jsx("button",{className:"back-button",onClick:ne,children:s.jsx(ge,{size:28})}),s.jsxs("div",{className:"game-header",children:[s.jsx("h2",{children:"💣Sıkı Takip💣"}),d!=="waiting"&&s.jsxs("div",{className:"word-section",children:[s.jsxs("h3",{children:["Gizli Kelime (",y.length," harf):"]}),le()]}),s.jsxs("div",{className:"game-info",children:[s.jsxs("span",{children:["Seviye: ",v]}),s.jsxs("span",{children:["Puan: ",b]}),s.jsxs("span",{style:{color:p===1?"#ff4d4d":"white",border:p===1?"1px solid #ff4d4d":"1px solid rgba(255,255,255,0.2)"},children:["❤️ Hak: ",p]})]}),s.jsxs("div",{className:"settings",children:[s.jsx("button",{className:`setting-btn ${A?"active":""}`,onClick:()=>te(!A),children:"🔊 Ses"}),s.jsx("button",{className:`setting-btn ${G?"active":""}`,onClick:()=>se(!G),children:"📳 Titreşim"})]})]}),s.jsx("div",{className:"simon-grid",children:ce()}),s.jsxs("div",{className:"game-controls",children:[d==="waiting"&&s.jsx("button",{className:"start-btn",onClick:ae,children:"🚀 Oyunu Başlat"}),(d==="playing"||d==="showing")&&!J&&s.jsx("button",{className:"guess-btn",onClick:()=>S(!0),disabled:d==="showing",children:"🤔 Kelimeyi Tahmin Et"}),J&&d==="playing"&&s.jsxs("div",{className:"guess-section",children:[s.jsx("input",{type:"text",value:q,onChange:n=>h(n.target.value.toUpperCase()),placeholder:"Kelimeyi yazın...",className:"guess-input",maxLength:16,autoFocus:!0}),s.jsxs("div",{className:"guess-buttons",children:[s.jsx("button",{className:"submit-guess-btn",onClick:re,children:"✅ Gönder"}),s.jsx("button",{className:"cancel-guess-btn",onClick:()=>{S(!1),h("")},children:"❌ İptal"})]})]}),d==="gameOver"&&s.jsxs("div",{className:"game-over",children:[s.jsxs("p",{children:["🎯 Oyun Bitti! Final Puanınız: ",b]}),s.jsxs("p",{children:["Kelime: ",s.jsx("strong",{children:y})]}),s.jsx("button",{className:"restart-btn",onClick:ie,children:"🔄 Tekrar Oyna"})]})]}),j.show&&s.jsx("div",{className:"modal-overlay",children:s.jsxs("div",{className:`modal-content ${j.type}`,children:[s.jsx("h3",{children:j.title}),s.jsx("p",{children:j.message}),p>0?s.jsx("button",{onClick:V,children:"Tamam"}):s.jsx("button",{onClick:V,children:"Sonuçları Gör"})]})}),s.jsx("style",{children:`
        .simon-game {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
          font-family: Arial, sans-serif;
          text-align: center;
          color: white;
          box-sizing: border-box;
          position: relative; /* Geri butonu için */
        }

        /* YENİ EKLENEN GERİ BUTONU STİLİ */
        .back-button {
          position: absolute;
          top: 15px;
          left: 15px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 45px;
          height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          backdrop-filter: blur(5px);
          transition: all 0.3s ease;
          z-index: 10;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.1);
        }

        .game-header h2 {
          margin-bottom: 20px;
          margin-top: 35px; /* Başlığı butonla çakışmaması için biraz aşağı ittik */
          color: white;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          font-size: 24px;
        }

        .word-section { margin: 20px 0; }
        .word-section h3 {
          color: #64ffda;
          font-size: 16px;
          margin-bottom: 10px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }
        .word-display {
          display: flex;
          justify-content: center;
          gap: 4px;
          flex-wrap: wrap;
          margin: 10px 0;
        }
        .word-letter {
          width: 28px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.3);
          transition: all 0.3s ease;
        }
        .word-letter.revealed {
          background: rgba(100, 255, 218, 0.3);
          border-color: #64ffda;
          color: #64ffda;
          animation: letterReveal 0.5s ease;
        }
        @keyframes letterReveal {
          0% { transform: scale(0.5) rotateY(90deg); }
          50% { transform: scale(1.2) rotateY(0deg); }
          100% { transform: scale(1) rotateY(0deg); }
        }
        .game-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .game-info span {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: bold;
          transition: all 0.3s ease;
        }
        .settings {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .setting-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 12px;
          backdrop-filter: blur(10px);
        }
        .setting-btn.active {
          background: rgba(100, 255, 100, 0.3);
          border-color: #64ff64;
          color: #64ff64;
          box-shadow: 0 0 15px rgba(100, 255, 100, 0.3);
        }
        .simon-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 25px 0;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
        }
        .grid-cell {
          aspect-ratio: 1;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .cell-letter {
          font-size: 24px;
          color: #64ffda;
          text-shadow: 0 0 10px rgba(100, 255, 218, 0.5);
          animation: letterPop 0.3s ease;
        }
        @keyframes letterPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .grid-cell.active {
          background: linear-gradient(45deg, #ff6b6b, #feca57) !important;
          transform: scale(1.08);
          box-shadow: 0 0 25px rgba(255, 202, 87, 0.8);
        }
        .game-controls { margin: 20px 0; }
        .start-btn, .restart-btn, .guess-btn {
          background: linear-gradient(45deg, #48cae4, #023e8a);
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 30px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(72, 202, 228, 0.3);
          margin: 5px;
        }
        .guess-btn { background: linear-gradient(45deg, #ffd60a, #e85d04); }
        .guess-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .guess-section {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          margin-top: 15px;
        }
        .guess-input {
          width: 100%;
          max-width: 300px;
          padding: 12px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 18px;
          text-align: center;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .guess-input::placeholder { color: rgba(255, 255, 255, 0.5); }
        .guess-buttons { display: flex; gap: 10px; justify-content: center; }
        .submit-guess-btn, .cancel-guess-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .submit-guess-btn { background: linear-gradient(45deg, #10b981, #059669); color: white; }
        .cancel-guess-btn { background: rgba(239, 68, 68, 0.8); color: white; }
        .game-over {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 15px;
          animation: fadeIn 0.5s ease;
        }
        .game-over p { margin-bottom: 15px; font-size: 18px; color: #feca57; }
        .game-over strong { color: #64ffda; font-size: 20px; }
        
        /* MODAL STYLES */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          background: rgba(30, 30, 40, 0.95);
          border: 2px solid rgba(255, 255, 255, 0.1);
          padding: 30px;
          border-radius: 20px;
          text-align: center;
          max-width: 80%;
          width: 300px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .modal-content.success { border-color: #00b894; box-shadow: 0 0 20px rgba(0, 184, 148, 0.3); }
        .modal-content.error { border-color: #ff7675; box-shadow: 0 0 20px rgba(255, 118, 117, 0.3); }
        .modal-content h3 { margin-top: 0; font-size: 24px; margin-bottom: 10px; }
        .modal-content.success h3 { color: #55efc4; }
        .modal-content.error h3 { color: #ff7675; }
        .modal-content p { color: #dfe6e9; font-size: 16px; margin-bottom: 25px; line-height: 1.5; }
        .modal-content button {
          background: linear-gradient(45deg, #6c5ce7, #a29bfe);
          border: none;
          padding: 10px 30px;
          color: white;
          border-radius: 25px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s;
          font-size: 16px;
        }
        .modal-content button:hover { transform: scale(1.05); }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        @media (max-width: 480px) {
          .simon-game { padding: 15px; }
          .word-letter { width: 24px; height: 30px; font-size: 16px; }
          .simon-grid { max-width: 280px; gap: 6px; }
          .cell-letter { font-size: 20px; }
        }
      `})]})};export{xe as default};
