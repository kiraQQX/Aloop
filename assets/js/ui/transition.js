/* Central page transition + load mask. One controller; respects reduced motion. */
(function(){const A=window.Aloop=window.Aloop||{};const c=document.getElementById("curtain");if(!c)return;
const rm=matchMedia("(prefers-reduced-motion: reduce)").matches;let busy=false;
const done=()=>{document.documentElement.classList.remove("is-loading");c.classList.remove("on")};
if(document.readyState==="complete")requestAnimationFrame(done);else addEventListener("load",()=>requestAnimationFrame(done),{once:true});
setTimeout(done,2500);
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest('a[href^="#/"]');
 if(!a||rm||busy||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||a.target)return;const h=a.getAttribute("href");if(h===location.hash)return;
 e.preventDefault();busy=true;c.classList.add("on");setTimeout(()=>{location.hash=h;setTimeout(()=>{c.classList.remove("on");busy=false},120)},380)},true);
})();
