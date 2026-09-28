
/* ================= PACKAI BACKEND AUTHENTICATION ================= */
(function () {
  const USER_KEY = "packai_user";
  const SESSION_KEY = "packai_session";
  const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : "";

  const authScreen = document.getElementById("authScreen");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const loginTab = document.getElementById("loginTab");
  const signupTab = document.getElementById("signupTab");
  const loginError = document.getElementById("loginError");
  const signupError = document.getElementById("signupError");
  const profileBar = document.getElementById("profileBar");
  const profileName = document.getElementById("profileName");
  const profileEmail = document.getElementById("profileEmail");
  const navUserName = document.getElementById("navUserName");
  const logoutBtn = document.getElementById("logoutBtn");
  const navLogoutBtn = document.getElementById("navLogoutBtn");

  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch (_) { return null; }
  }

  function isLoggedIn() {
    return localStorage.getItem(SESSION_KEY) === "true" && !!getUser();
  }

  function showLogin() {
    authScreen.classList.remove("hidden");
    profileBar.classList.add("hidden");
    document.body.style.overflow = "hidden";
  }

  function showDashboard() {
    const user = getUser();
    if (!user) return showLogin();
    authScreen.classList.add("hidden");
    profileBar.classList.remove("hidden");
    profileName.textContent = user.name || "User";
    profileEmail.textContent = user.email || "";
    navUserName.textContent = `Hi, ${user.name || "User"}`;
    document.body.style.overflow = "";
  }

  function switchTab(mode) {
    const login = mode === "login";
    loginTab.classList.toggle("active", login);
    signupTab.classList.toggle("active", !login);
    loginForm.classList.toggle("hidden", !login);
    signupForm.classList.toggle("hidden", login);
    loginError.textContent = "";
    signupError.textContent = "";
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.message || `Server error (${response.status})`);
    return data;
  }

  loginTab.addEventListener("click", () => switchTab("login"));
  signupTab.addEventListener("click", () => switchTab("signup"));

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    signupError.textContent = "";
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirm = document.getElementById("signupConfirm").value;

    if (password.length < 6) return signupError.textContent = "Password must contain at least 6 characters.";
    if (password !== confirm) return signupError.textContent = "Passwords do not match.";

    try {
      const data = await api("/api/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(SESSION_KEY, "true");
      signupForm.reset();
      showDashboard();
    } catch (err) {
      signupError.textContent = err.message || "Cannot connect to PackAI backend.";
      if (err.message.includes("already exists")) {
        switchTab("login");
        document.getElementById("loginEmail").value = email;
      }
    }
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loginError.textContent = "";
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const password = document.getElementById("loginPassword").value;

    try {
      const data = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(SESSION_KEY, "true");
      loginForm.reset();
      showDashboard();
    } catch (err) {
      loginError.textContent = err.message || "Cannot connect to PackAI backend.";
    }
  });

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    loginForm.reset();
    signupForm.reset();
    switchTab("login");
    showLogin();
  }

  logoutBtn.addEventListener("click", logout);
  navLogoutBtn.addEventListener("click", logout);

  if (isLoggedIn()) showDashboard();
  else showLogin();

  window.PackAI_API = { api, getUser, base: API_BASE };
})();

const form=document.getElementById("packagingForm");
const commodityEl=document.getElementById("commodity");
const foodItemEl=document.getElementById("foodItem");
const moistureEl=document.getElementById("moisture");
const fatEl=document.getElementById("fat");
const phEl=document.getElementById("ph");
const respirationEl=document.getElementById("respiration");
const shelfLifeEl=document.getElementById("shelfLife");
const temperatureEl=document.getElementById("temperature");
const humidityEl=document.getElementById("humidity");
const transportEl=document.getElementById("transport");
const storageEl=document.getElementById("storage");
const memoryStatusBadge=document.getElementById("memoryStatusBadge");
const memoryStatusText=document.getElementById("memoryStatusText");
const memoryList=document.getElementById("memoryList");
const memoryCount=document.getElementById("memoryCount");
const groqStatusBadge=document.getElementById("groqStatusBadge");
const groqAdvice=document.getElementById("groqAdvice");
const groqAdviceBtn=document.getElementById("groqAdviceBtn");
let latestGroqPayload=null;

async function getGroqStatus(){
  try { return await window.PackAI_API.api("/api/groq/status"); }
  catch(err){ return {success:false,configured:false,message:err.message}; }
}
async function refreshGroqStatus(){
  const data=await getGroqStatus();
  if(!groqStatusBadge) return data;
  groqStatusBadge.textContent=data.configured?"● Connected":"○ Not configured";
  groqStatusBadge.className=`memory-badge ${data.configured?"connected":"offline"}`;
  if(groqAdviceBtn) groqAdviceBtn.disabled=!data.configured || !latestGroqPayload;
  return data;
}
async function askGroq(payload){
  return await window.PackAI_API.api("/api/groq/advice",{method:"POST",body:JSON.stringify(payload)});
}
/* Real-time streaming from Groq via Server-Sent Events. Calls onText(fullTextSoFar) on every token batch. */
async function streamGroq(payload,onText){
  const response=await fetch(`${window.PackAI_API.base}/api/groq/stream`,{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
  });
  if(!response.ok){
    let msg=`Server error (${response.status})`;
    try{ msg=(await response.json()).message||msg; }catch(_){}
    throw new Error(msg);
  }
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let buffer="",text="";
  while(true){
    const {value,done}=await reader.read();
    if(done) break;
    buffer+=decoder.decode(value,{stream:true});
    let idx;
    while((idx=buffer.indexOf("\n\n"))!==-1){
      const block=buffer.slice(0,idx);buffer=buffer.slice(idx+2);
      const line=block.split("\n").find(l=>l.startsWith("data:"));
      if(!line) continue;
      let evt;try{ evt=JSON.parse(line.slice(5).trim()); }catch(_){ continue; }
      if(evt.error) throw new Error(evt.error);
      if(evt.delta){ text+=evt.delta; onText(text); }
    }
  }
  if(!text.trim()) throw new Error("Groq returned an empty answer.");
  return text;
}
let groqRunId=0;
/* Streams advice into the card; falls back to the plain JSON endpoint if streaming fails. */
async function runGroqAdvice(){
  if(!groqAdvice || !latestGroqPayload) return;
  const runId=++groqRunId;
  const isCurrent=()=>runId===groqRunId;
  if(groqAdviceBtn) groqAdviceBtn.disabled=true;
  groqAdvice.textContent="Asking Groq to explain this recommendation…";
  let shown="";
  try{
    await streamGroq(latestGroqPayload,t=>{ if(isCurrent()){ shown=t; groqAdvice.textContent=t; } });
  }catch(streamErr){
    if(!isCurrent()) return;
    console.warn("Groq streaming failed, trying standard request:",streamErr.message);
    try{
      const result=await askGroq(latestGroqPayload);
      if(isCurrent()) groqAdvice.textContent=result.success?result.advice:`Groq is not available: ${result.message||"check GROQ_API_KEY"}`;
    }catch(err){
      if(isCurrent()) groqAdvice.textContent=shown?shown:`Groq is not available: ${err.message}`;
    }
  }finally{
    if(isCurrent() && groqAdviceBtn){ const s=await getGroqStatus(); groqAdviceBtn.disabled=!s.configured || !latestGroqPayload; }
  }
}

async function getHindsightStatus(){
  try { return await window.PackAI_API.api("/api/memory/status"); }
  catch(err){ return {success:false,configured:false,message:err.message}; }
}
function renderMemoryStatus(data){
  if(!memoryStatusBadge) return;
  const configured=!!data?.configured;
  memoryStatusBadge.textContent=configured?"● Connected":"○ Not configured";
  memoryStatusBadge.className=`memory-badge ${configured?"connected":"offline"}`;
  memoryStatusText.textContent=configured?`Hindsight bank: ${data.bank_id || "packai-memory"}`:(data.message || "Add HINDSIGHT_API_KEY to enable persistent Hindsight memory.");
}
async function refreshHindsightStatus(){ renderMemoryStatus(await getHindsightStatus()); }
async function recallPackAIMemory(query){
  try { return await window.PackAI_API.api("/api/memory/recall", {method:"POST",body:JSON.stringify({query})}); }
  catch(err){ return {success:false,configured:false,memories:[],message:err.message}; }
}
async function retainPackAIMemory(content, context){
  try { return await window.PackAI_API.api("/api/memory/retain", {method:"POST",body:JSON.stringify({content,context})}); }
  catch(err){ console.error("Hindsight retain failed",err); return {success:false,message:err.message}; }
}
function renderMemories(memories){
  if(!memoryList) return;
  const items=(memories||[]).slice(0,6);
  memoryCount.textContent=String(items.length);
  memoryList.innerHTML = items.length ? items.map(m=>`<div class="memory-item"><span class="memory-type">${m.type||"memory"}</span><p>${escapeHtml(m.text||"")}</p></div>`).join("") : '<div class="memory-empty">No relevant memories yet. Complete an analysis or save a preference.</div>';
}
function escapeHtml(value){ return String(value).replace(/[&<>\"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch])); }
function buildMemoryQuery(c, food, x){ return `PackAI user packaging preferences and past decisions for ${food || c}. Preferred packaging materials, recyclability, cost, shelf life, sustainability, and previous recommendation outcomes.`; }

const resultsEl=document.getElementById("results");
const materialNameEl=document.getElementById("materialName");
const materialDescriptionEl=document.getElementById("materialDescription");
const matchScoreEl=document.getElementById("matchScore");
const otrEl=document.getElementById("otr");
const wvtrEl=document.getElementById("wvtr");
const thicknessEl=document.getElementById("thickness");
const sealabilityEl=document.getElementById("sealability");
const strengthEl=document.getElementById("strength");
const mapEl=document.getElementById("map");
const oxygenEl=document.getElementById("oxygen");
const carbonEl=document.getElementById("carbon");
const nitrogenEl=document.getElementById("nitrogen");
const sustainabilityEl=document.getElementById("sustainability");
const sustainabilityBarEl=document.getElementById("sustainabilityBar");
const costLevelEl=document.getElementById("costLevel");
const costTextEl=document.getElementById("costText");
const estimatedShelfEl=document.getElementById("estimatedShelf"); const shelfLifeMonthsEl=document.getElementById("shelfLifeMonths"); const recyclabilityEl=document.getElementById("recyclability"); const recyclabilityNoteEl=document.getElementById("recyclabilityNote"); const alternativeMaterialsEl=document.getElementById("alternativeMaterials"); const manufacturersEl=document.getElementById("manufacturers"); const materialReasonEl=document.getElementById("materialReason");

const referenceFoods=[
 {item:"Apple",icon:"🍎",commodity:"fruits",moisture:"84–86",fat:"0.1–0.5",ph:"3.3–4.0",respiration:"Medium",rh:"90–95",temp:"0–5"},
 {item:"Banana",icon:"🍌",commodity:"fruits",moisture:"72–76",fat:"0.2–0.5",ph:"4.5–5.2",respiration:"High",rh:"90–95",temp:"12–16"},
 {item:"Tomato",icon:"🍅",commodity:"vegetables",moisture:"93–95",fat:"0.1–0.3",ph:"4.2–4.9",respiration:"Medium",rh:"85–95",temp:"8–12"},
 {item:"Carrot",icon:"🥕",commodity:"vegetables",moisture:"87–89",fat:"0.1–0.3",ph:"5.9–6.5",respiration:"Low",rh:"95–100",temp:"0–2"},
 {item:"Potato",icon:"🥔",commodity:"vegetables",moisture:"77–80",fat:"0.1–0.3",ph:"5.3–5.9",respiration:"Low",rh:"90–95",temp:"4–12"},
 {item:"Potato Chips",icon:"🍟",commodity:"snacks",moisture:"1–5",fat:"25–40",ph:"5.5–7.0",respiration:"Low",rh:"30–50",temp:"15–25"},
 {item:"Biscuits",icon:"🍪",commodity:"snacks",moisture:"2–8",fat:"10–25",ph:"5.5–7.0",respiration:"Low",rh:"30–50",temp:"15–25"},
 {item:"Rice",icon:"🍚",commodity:"grains",moisture:"10–14",fat:"0.5–2.5",ph:"6.0–7.0",respiration:"Low",rh:"50–65",temp:"15–25"},
 {item:"Wheat",icon:"🌾",commodity:"grains",moisture:"10–14",fat:"1.5–3.0",ph:"6.0–7.0",respiration:"Low",rh:"50–65",temp:"15–25"},
 {item:"Bread",icon:"🍞",commodity:"bakery",moisture:"30–40",fat:"2–10",ph:"5.0–6.5",respiration:"Low",rh:"50–70",temp:"20–25"},
 {item:"Cake",icon:"🍰",commodity:"bakery",moisture:"20–35",fat:"10–25",ph:"5.5–7.0",respiration:"Low",rh:"50–70",temp:"15–25"},
 {item:"Chicken",icon:"🍗",commodity:"meat",moisture:"65–75",fat:"5–20",ph:"5.8–6.5",respiration:"Low",rh:"85–95",temp:"0–4"},
 {item:"Beef",icon:"🥩",commodity:"meat",moisture:"60–75",fat:"5–25",ph:"5.4–6.2",respiration:"Low",rh:"85–95",temp:"0–4"},
 {item:"Milk",icon:"🥛",commodity:"dairy",moisture:"87–89",fat:"3–4",ph:"6.4–6.8",respiration:"Low",rh:"80–90",temp:"1–4"},
 {item:"Yogurt",icon:"🥣",commodity:"dairy",moisture:"80–88",fat:"0.5–4",ph:"4.0–4.6",respiration:"Low",rh:"80–90",temp:"1–4"},
 {item:"Turmeric Powder",icon:"🟡",commodity:"spices",moisture:"5–10",fat:"2–8",ph:"5.0–7.0",respiration:"Low",rh:"40–60",temp:"15–25"},
 {item:"Chilli Powder",icon:"🌶️",commodity:"spices",moisture:"5–10",fat:"10–15",ph:"4.5–6.5",respiration:"Low",rh:"40–60",temp:"15–25"}
];

function populateFoodItems(category){
 if(!foodItemEl)return;
 const items=referenceFoods.filter(f=>f.commodity===category);
 foodItemEl.innerHTML='<option value="">Select an item</option>'+items.map(f=>`<option value="${f.item}">${f.icon}  ${f.item}</option>`).join("");
 updateFoodItemIcon("");
}

function renderReferenceChart(){
 const tbody=document.getElementById("referenceTableBody");
 if(!tbody)return;
 const labels={fruits:"Fresh Fruits",vegetables:"Fresh Vegetables",snacks:"Snacks / Chips",grains:"Grains / Cereals",bakery:"Bakery Products",meat:"Meat Products",dairy:"Dairy Products",spices:"Spices"};
 tbody.innerHTML=referenceFoods.map((f,i)=>`<tr><td>${labels[f.commodity]||f.commodity}</td><td><span class="table-food-icon">${f.icon}</span><strong class="table-food-name">${f.item}</strong></td><td>${f.moisture}</td><td>${f.fat}</td><td>${f.ph}</td><td>${f.respiration}</td><td>${f.rh}</td><td>${f.temp}</td><td><button type="button" class="use-example" onclick="useReferenceFood(${i})">Use</button></td></tr>`).join("");
}

function useReferenceFood(index){
 const f=referenceFoods[index];
 if(!f)return;
 commodityEl.value=f.commodity;
 populateFoodItems(f.commodity);
 foodItemEl.value=f.item;
 useFoodItem(f.item);
 document.getElementById("packagingForm").scrollIntoView({behavior:"smooth",block:"start"});
}

function updateFoodItemIcon(itemName){
 const iconEl=document.getElementById("foodItemIcon");
 const nameEl=document.getElementById("foodItemName");
 const f=referenceFoods.find(x=>x.item===itemName);
 if(!iconEl || !nameEl)return;
 if(f){
   iconEl.textContent=f.icon;
   iconEl.classList.add("has-food");
   nameEl.textContent=f.item;
 }else{
   iconEl.textContent="🍽️";
   iconEl.classList.remove("has-food");
   nameEl.textContent="Choose a food item";
 }
}

function useFoodItem(itemName){
 const f=referenceFoods.find(x=>x.item===itemName);
 if(!f){
   updateFoodItemIcon("");
   return;
 }
 updateFoodItemIcon(f.item);
 const first=(v)=>parseFloat(String(v).replace("–","-"));
 document.getElementById("moisture").value=first(f.moisture);
 document.getElementById("fat").value=first(f.fat);
 document.getElementById("ph").value=first(f.ph);
 document.getElementById("respiration").value=f.respiration.toLowerCase();
 document.getElementById("humidity").value=first(f.rh);
 document.getElementById("temperature").value=first(f.temp);
}

if(commodityEl){
 commodityEl.addEventListener("change",()=>{
   populateFoodItems(commodityEl.value);
 });
}
if(foodItemEl){
 foodItemEl.addEventListener("change",()=>useFoodItem(foodItemEl.value));
}
populateFoodItems(commodityEl ? commodityEl.value : "fruits");
updateFoodItemIcon(foodItemEl ? foodItemEl.value : "");
renderReferenceChart();
refreshHindsightStatus();
refreshGroqStatus();

async function saveRecommendationToDatabase(data){
  try {
    const user = window.PackAI_API && window.PackAI_API.getUser ? window.PackAI_API.getUser() : null;
    const api = window.PackAI_API && window.PackAI_API.api;
    if (!api) throw new Error("PackAI backend API is not available.");
    await api("/api/recommendations", { method:"POST", body:JSON.stringify({
      user_email:user ? user.email : null,
      commodity:data.commodity,
      food_item:data.food_item,
      moisture:data.moisture,
      fat:data.fat,
      ph:data.ph,
      respiration:data.respiration,
      shelf_life:data.shelf_life,
      temperature:data.temperature,
      humidity:data.humidity,
      transport:data.transport,
      storage:data.storage,
      material:data.material,
      description:data.description,
      match_score:data.match_score,
      otr:data.otr,
      wvtr:data.wvtr,
      thickness:data.thickness,
      sealability:data.sealability,
      strength:data.strength,
      map_suitability:data.map_suitability,
      oxygen:data.oxygen,
      carbon_dioxide:data.carbon_dioxide,
      nitrogen:data.nitrogen,
      sustainability:data.sustainability,
      cost_level:data.cost_level,
      estimated_shelf:data.estimated_shelf,
      recyclability:data.recyclability,
      reason:data.reason
    })});
    console.log("PackAI: recommendation saved to SQLite");
    return true;
  } catch(err){
    console.error("PackAI database save failed:",err);
    return false;
  }
}

form.addEventListener("submit",async e=>{e.preventDefault();
const c=commodityEl.value,m=+moistureEl.value,f=+fatEl.value,r=respirationEl.value,s=+shelfLifeEl.value,t=+temperatureEl.value,h=+humidityEl.value,tr=transportEl.value,st=storageEl.value;
const selectedFood=foodItemEl.value || c;
const memoryQuery=buildMemoryQuery(c,selectedFood,{material:""});
const memoryResponse=await recallPackAIMemory(memoryQuery);
const recalledMemories=memoryResponse.memories || [];
renderMemories(recalledMemories);
let x={material:"PET / PE Laminate",desc:"High barrier packaging structure suitable for moisture and oxygen-sensitive food products.",otr:"Low",wvtr:"Low",thickness:"70–100 μm",seal:"Excellent",strength:"High",map:"Suitable",o:5,co:5,n:90,sus:82,cost:"Medium",ct:"Balanced between cost and performance.",shelf:"14–18 Days",match:94,recycle:"Conditionally Recyclable",recycleNote:"Multilayer laminates are difficult to recycle in many local systems; recyclability depends on the collection and processing facility.",alternatives:["Mono-material PE film","Paper / board with barrier coating","Bio-based film where suitable"],manufacturers:["Amcor","UFlex","Huhtamaki","Mondi","Berry Global"],reason:"PET / PE is used when the food needs a combination of moisture and oxygen protection, reliable heat sealing, mechanical strength and practical shelf-life performance."};
if(c==="fruits")x={...x,material:"Breathable / Micro-Perforated Film",desc:"Breathable packaging designed to control moisture and respiration of fresh fruits.",otr:"High",wvtr:"Medium",thickness:"30–60 μm",seal:"Good",strength:"Medium",map:"Highly Suitable",sus:88,cost:"Low–Medium",ct:"Cost-effective solution for fresh produce.",shelf:s<=7?"5–8 Days":"10–16 Days",match:92,recycle:"Conditionally Recyclable",recycleNote:"Micro-perforated plastic films are recyclable only where the local facility accepts and processes the film.",alternatives:["Paper-based produce bags", "Mono-material PE film", "Cellulose-based breathable film where suitable"],manufacturers:["Amcor", "UFlex", "Berry Global"],reason:"Breathable micro-perforated film is used to manage respiration and moisture while reducing condensation and maintaining produce quality."};
if(c==="vegetables")x={...x,material:"Micro-Perforated PE Film",desc:"Breathable PE film suitable for vegetables with active respiration.",otr:"High",wvtr:"Medium",thickness:"25–50 μm",seal:"Good",strength:"Medium",map:"Suitable",sus:86,cost:"Low",ct:"Economical packaging for fresh vegetables.",shelf:s<=7?"4–7 Days":"8–14 Days",match:91,recycle:"Conditionally Recyclable",recycleNote:"PE film can be recyclable through suitable film-recycling streams, but access varies by location.",alternatives:["Mono-material PE film", "Paper-based produce packaging", "Cellulose-based film where suitable"],manufacturers:["Amcor", "UFlex", "Berry Global"],reason:"Micro-perforated PE allows controlled gas exchange and moisture management for actively respiring vegetables."};
if(c==="snacks")x={...x,material:"Metallized PET / PE",desc:"High oxygen and moisture barrier packaging suitable for crispy snack products.",otr:"Very Low",wvtr:"Very Low",thickness:"60–90 μm",seal:"Excellent",strength:"High",map:"Suitable",o:0,co:0,n:100,sus:65,cost:"Medium",ct:"Good performance with moderate packaging cost.",shelf:s<=14?"3–5 Months":"6–9 Months",match:96,recycle:"Conditionally Recyclable",recycleNote:"Metallized PET/PE laminates are generally difficult to recycle through conventional single-material plastic streams.",alternatives:["Mono-material PE high-barrier film", "Mono-material PP high-barrier film", "Paper-based high-barrier pack where suitable"],manufacturers:["Amcor", "UFlex", "Mondi", "Huhtamaki"],reason:"The metallized structure provides strong oxygen and moisture barriers that help preserve crispness, aroma and fat-sensitive snack quality."};
if(c==="grains")x={...x,material:"HDPE / EVOH Barrier Pack",desc:"Strong moisture-resistant packaging suitable for grains and cereals.",otr:"Low",wvtr:"Very Low",thickness:"70–120 μm",seal:"Excellent",strength:"High",map:"Optional",o:0,co:0,n:100,sus:74,cost:"Low",ct:"Affordable structure with strong moisture protection.",shelf:s<=30?"3–6 Months":"9–12 Months",match:94,recycle:"Conditionally Recyclable",recycleNote:"HDPE structures are widely recyclable where accepted; EVOH-containing multilayers may require compatible recycling infrastructure.",alternatives:["Mono-material HDPE", "PP-based barrier pack", "Paper / board with barrier lining where suitable"],manufacturers:["Amcor", "UFlex", "Berry Global", "Mondi"],reason:"The barrier pack protects grains from moisture and oxygen while providing strength, sealability and long storage performance."};
if(c==="bakery")x={...x,material:"LDPE / PET Laminate",desc:"Flexible packaging providing moisture protection and good sealability.",otr:"Medium",wvtr:"Low",thickness:"50–80 μm",seal:"Excellent",strength:"Medium",map:"Suitable",o:2,co:8,n:90,sus:78,cost:"Medium",ct:"Balanced packaging solution for bakery products.",shelf:"7–20 Days",match:90,recycle:"Conditionally Recyclable",recycleNote:"PET/PE laminates are difficult to recycle in many conventional systems because they combine different polymers.",alternatives:["Mono-material PE film", "Paper-based bakery bag with barrier coating", "PP-based flexible pack"],manufacturers:["Amcor", "UFlex", "Huhtamaki"],reason:"The laminate provides moisture control, good sealing and mechanical protection to help bakery products retain quality."};
if(c==="meat")x={...x,material:"PA / PE Vacuum Packaging",desc:"High-strength barrier packaging designed for chilled and frozen meat products.",otr:"Very Low",wvtr:"Very Low",thickness:"80–120 μm",seal:"Excellent",strength:"Very High",map:"Highly Suitable",o:30,co:40,n:30,sus:62,cost:"Medium–High",ct:"Higher cost due to advanced barrier requirements.",shelf:st==="frozen"?"6–12 Months":"10–20 Days",match:97,recycle:"Conditionally Recyclable",recycleNote:"PA/PE vacuum laminates are generally not accepted in standard plastic recycling streams because they contain multiple polymers.",alternatives:["Mono-material PE vacuum film", "High-barrier PE-based vacuum pack", "Rigid recyclable tray with compatible lidding film"],manufacturers:["Amcor", "Berry Global", "Mondi"],reason:"PA/PE vacuum packaging combines high puncture resistance, strong seals and oxygen/moisture barriers needed for chilled or frozen meat."};
if(c==="dairy")x={...x,material:"HDPE / PET Barrier Packaging",desc:"Food-grade barrier packaging designed for moisture and oxygen-sensitive dairy products.",otr:"Low",wvtr:"Low",thickness:"50–100 μm",seal:"Excellent",strength:"High",map:"Suitable",o:2,co:5,n:93,sus:77,cost:"Medium",ct:"Balanced cost with strong food protection.",shelf:st==="chilled"?"10–30 Days":"5–10 Days",match:93,recycle:"Conditionally Recyclable",recycleNote:"Recyclability depends on the exact HDPE/PET structure and the local collection and sorting system.",alternatives:["Mono-material HDPE", "Mono-material PET", "Paper-based barrier carton where suitable"],manufacturers:["Amcor", "Huhtamaki", "Berry Global", "Mondi"],reason:"The barrier structure helps protect dairy products from oxygen and moisture while providing food-safe strength and reliable sealing."};
if(c==="spices")x={...x,material:"Aluminum Foil / PET / PE Laminate",desc:"Excellent barrier structure for aroma, moisture and oxygen-sensitive spices.",otr:"Extremely Low",wvtr:"Extremely Low",thickness:"80–120 μm",seal:"Excellent",strength:"High",map:"Suitable",o:0,co:0,n:100,sus:60,cost:"Medium–High",ct:"Higher barrier performance increases packaging cost.",shelf:"9–18 Months",match:98,recycle:"Conditionally Recyclable",recycleNote:"Aluminum/PET/PE laminates are generally difficult to recycle in conventional single-material recycling systems.",alternatives:["Mono-material high-barrier PE", "Mono-material PP high-barrier pack", "Paper-based high-barrier pack where suitable"],manufacturers:["Amcor", "UFlex", "Mondi", "Huhtamaki"],reason:"The foil laminate provides an extremely strong barrier against moisture, oxygen and aroma loss, which is important for spices."};
if(m>60)x.wvtr="Very Low";if(f>20)x.otr="Very Low";if(h>75)x.wvtr="Very Low";if(tr==="rough"){x.strength="Very High";x.thickness="90–130 μm"}if(st==="frozen")x.thickness="90–130 μm";if(r==="high")x.map="Highly Suitable";x.match=Math.min(99,x.match+((m>60||f>20||h>75||tr==="rough")?1:0));x.sus=Math.max(40,Math.min(98,x.sus));
// Use recalled user preferences to personalize the presentation without overriding technical constraints.
const memoryText=recalledMemories.map(m=>String(m.text||"").toLowerCase()).join(" ");
if(memoryText.includes("recyclable") || memoryText.includes("sustainability")){
  x.alternatives=[...x.alternatives].sort((a,b)=>((/mono-material|paper|cellulose/i.test(a)?-1:1))-((/mono-material|paper|cellulose/i.test(b)?-1:1)));
  x.ct=`Personalized for your sustainability preference. ${x.ct}`;
}
if(memoryText.includes("lower") || memoryText.includes("cost")){
  x.ct=`Personalized for your cost preference. ${x.ct}`;
}
if(memoryText.includes("longer shelf") || memoryText.includes("shelf life")){
  x.ct=`Personalized for your shelf-life preference. ${x.ct}`;
}

// Build the Groq payload only after the recommendation has been calculated.
// The previous version referenced `x` before it was declared, which stopped
// the entire Analyze & Recommend handler with a ReferenceError.
latestGroqPayload={
  product:selectedFood,
  inputs:{moisture:m,fat:f,ph:+phEl.value,respiration:r,shelf_life:s,temperature:t,humidity:h,transport:tr,storage:st},
  recommendation:{material:x.material,description:x.desc,match_score:x.match,otr:x.otr,wvtr:x.wvtr,thickness:x.thickness,sealability:x.seal,strength:x.strength,sustainability:x.sus,cost:x.cost,estimated_shelf:x.shelf,recyclability:x.recycle,reason:x.reason},
  memories:recalledMemories
};
refreshGroqStatus();
materialNameEl.textContent=x.material;materialDescriptionEl.textContent=x.desc;matchScoreEl.textContent=x.match+"%";otrEl.textContent=x.otr;wvtrEl.textContent=x.wvtr;thicknessEl.textContent=x.thickness;sealabilityEl.textContent=x.seal;strengthEl.textContent=x.strength;mapEl.textContent=x.map;oxygenEl.textContent=x.o+"%";carbonEl.textContent=x.co+"%";nitrogenEl.textContent=x.n+"%";sustainabilityEl.textContent=x.sus;sustainabilityBarEl.style.width=x.sus+"%";costLevelEl.textContent=x.cost;costTextEl.textContent=x.ct;estimatedShelfEl.textContent=x.shelf;const shelfMatch=x.shelf.match(/(\d+)\s*[–-]\s*(\d+)\s*Days/i);if(shelfMatch){shelfLifeMonthsEl.textContent=`Approximately ${(Number(shelfMatch[1])/30).toFixed(1)}–${(Number(shelfMatch[2])/30).toFixed(1)} Months`;}else{shelfLifeMonthsEl.textContent=x.shelf.includes("Month")?x.shelf.replace(/Months?/i,"Months (days vary by exact conditions)"):"Estimated duration shown above";}recyclabilityEl.textContent=x.recycle;recyclabilityNoteEl.textContent=x.recycleNote;alternativeMaterialsEl.innerHTML=x.alternatives.map(v=>`<li>${v}</li>`).join("");manufacturersEl.innerHTML=x.manufacturers.map(v=>`<li>${v}</li>`).join("");materialReasonEl.textContent=x.reason;resultsEl.style.display="block";
const recommendationPayload={commodity:c,food_item:foodItemEl.value,moisture:m,fat:f,ph:+phEl.value,respiration:r,shelf_life:s,temperature:t,humidity:h,transport:tr,storage:st,material:x.material,description:x.desc,match_score:x.match,otr:x.otr,wvtr:x.wvtr,thickness:x.thickness,sealability:x.seal,strength:x.strength,map_suitability:x.map,oxygen:x.o,carbon_dioxide:x.co,nitrogen:x.n,sustainability:x.sus,cost_level:x.cost,estimated_shelf:x.shelf,recyclability:x.recycle,reason:x.reason};
resultsEl.dataset.databaseStatus="saving";
saveRecommendationToDatabase(recommendationPayload).then(saved=>{resultsEl.dataset.databaseStatus=saved?"saved":"failed";}).catch(()=>{resultsEl.dataset.databaseStatus="failed";});
const user=window.PackAI_API.getUser ? window.PackAI_API.getUser() : null;
const memoryContent=`PackAI interaction for ${selectedFood}. User inputs: moisture ${m}%, fat ${f}%, pH ${phEl.value}, respiration ${r}, desired shelf life ${s} days, temperature ${t}°C, humidity ${h}%, transport ${tr}, storage ${st}. PackAI recommended ${x.material}. Estimated shelf life: ${x.shelf}. Recyclability: ${x.recycle}. Sustainability score: ${x.sus}/100. Cost: ${x.cost}. This recommendation was generated for ${user?.email || "the user"}.`;
retainPackAIMemory(memoryContent,"packaging_recommendation").then(()=>refreshHindsightStatus());
runGroqAdvice();
resultsEl.scrollIntoView({behavior:"smooth"});});
if(groqAdviceBtn) groqAdviceBtn.addEventListener("click",runGroqAdvice);

if(document.getElementById("refreshMemoryBtn")) document.getElementById("refreshMemoryBtn").addEventListener("click",async()=>{
  await refreshHindsightStatus();
  const result=await recallPackAIMemory("What does the PackAI user prefer about packaging materials, cost, recyclability, sustainability, and shelf life?");
  renderMemories(result.memories||[]);
});

function scrollToRecommendation(){document.getElementById("recommend").scrollIntoView({behavior:"smooth"})}
function showHowItWorks(){alert("PackAI analyzes food properties, storage conditions, transportation requirements and desired shelf life, then recommends packaging specifications.")}
/* ===== Interactive UI effects ===== */
document.addEventListener("DOMContentLoaded",()=>{
  const revealItems=document.querySelectorAll(".reveal");
  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add("visible");observer.unobserve(entry.target)}
    }),{threshold:.12});
    revealItems.forEach(el=>observer.observe(el));
  }else revealItems.forEach(el=>el.classList.add("visible"));

  // Gentle pointer tilt on the hero analysis card for a more interactive dashboard feel.
  const card=document.querySelector(".package-card");
  if(card && window.matchMedia("(pointer:fine)").matches){
    card.addEventListener("mousemove",e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
      card.style.transform=`perspective(800px) rotateY(${x*5}deg) rotateX(${-y*4}deg) translateY(-6px)`;
    });
    card.addEventListener("mouseleave",()=>card.style.transform="");
  }

  // Add a subtle click ripple to primary interactive buttons.
  document.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",e=>{
    const ripple=document.createElement("span");
    ripple.className="ui-ripple";
    const r=btn.getBoundingClientRect();
    ripple.style.left=(e.clientX-r.left)+"px"; ripple.style.top=(e.clientY-r.top)+"px";
    btn.appendChild(ripple); setTimeout(()=>ripple.remove(),550);
  }));
});
