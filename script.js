const rooms = {
  baby: { title: "Baby Room", emoji: "👶" },
  toddler: { title: "Toddler Room", emoji: "🚶" },
  preschool: { title: "Preschool Room", emoji: "🎓" }
};

const categoryInfo = {
  events: {
    title: "Events",
    text: "Special celebrations, family days, cultural events and centre moments."
  },
  awards: {
    title: "Awards",
    text: "Achievements, certificates, milestones and proud learning moments."
  },
  activities: {
    title: "Everyday Activities",
    text: "Daily play, learning experiences, creative exploration and outdoor fun."
  }
};

let currentRole = null; // educator or parent
let currentRoom = null;
let currentCategory = "events";
let dragDropReady = false;

function isCloudinaryReady() {
  return CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET;
}

function makeTag(room, category) {
  return `gsg_${room}_${category}`;
}

function checkPassword() {
  const input = document.getElementById("passwordInput").value;
  const error = document.getElementById("errorMsg");

  if (input === EDUCATOR_PASSWORD) {
    currentRole = "educator";
    openApp();
  } else if (input === PARENT_PASSWORD) {
    currentRole = "parent";
    openApp();
  } else {
    error.textContent = "Incorrect password. Please try again.";
  }
}

function openApp() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("galleryApp").classList.remove("hidden");
  document.getElementById("errorMsg").textContent = "";
  document.body.classList.toggle("parent-mode", currentRole === "parent");
  document.body.classList.toggle("educator-mode", currentRole === "educator");
  document.getElementById("modeText").textContent = currentRole === "educator"
    ? "Educator Editor Mode"
    : "Parent View-Only Mode";

  if (!dragDropReady) {
    setupDragAndDrop();
    dragDropReady = true;
  }
}

function logout() {
  currentRole = null;
  currentRoom = null;
  currentCategory = "events";
  document.getElementById("galleryApp").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("roomScreen").classList.remove("hidden");
  document.getElementById("categoryArea").classList.add("hidden");
  document.getElementById("passwordInput").value = "";
}

function chooseRoom(room) {
  currentRoom = room;
  currentCategory = "events";
  document.getElementById("roomTitle").textContent = `${rooms[room].emoji} ${rooms[room].title}`;
  document.getElementById("roomScreen").classList.add("hidden");
  document.getElementById("categoryArea").classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelector(".tab").classList.add("active");
  showCategory("events", document.querySelector(".tab"));
  loadAllGalleries();
}

function backToRooms() {
  currentRoom = null;
  document.getElementById("categoryArea").classList.add("hidden");
  document.getElementById("roomScreen").classList.remove("hidden");
  updateStatus("Choose a room to load photos.");
}

function showCategory(category, button) {
  currentCategory = category;
  document.querySelectorAll(".category").forEach(section => section.classList.remove("active-category"));
  document.getElementById(category).classList.add("active-category");
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  button.classList.add("active");
  document.getElementById("categoryTitle").textContent = categoryInfo[category].title;
  document.getElementById("categoryText").textContent = categoryInfo[category].text;
}

function setupDragAndDrop() {
  document.querySelectorAll(".upload-card").forEach(card => {
    const category = card.dataset.category;
    card.onclick = () => {
      if (currentRole === "educator") card.querySelector("input").click();
    };
    card.ondragover = e => {
      if (currentRole !== "educator") return;
      e.preventDefault();
      card.classList.add("drag-over");
    };
    card.ondragleave = () => card.classList.remove("drag-over");
    card.ondrop = e => {
      if (currentRole !== "educator") return;
      e.preventDefault();
      card.classList.remove("drag-over");
      uploadFileList(e.dataTransfer.files, category);
    };
  });
}

function uploadImages(event, category) {
  uploadFileList(event.target.files, category);
  event.target.value = "";
}

async function uploadFileList(files, category) {
  if (currentRole !== "educator") return;
  if (!currentRoom) {
    updateStatus("Please choose a room first.");
    return;
  }
  if (!isCloudinaryReady()) {
    updateStatus("Cloudinary is not connected. Check config.js.");
    return;
  }

  const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
  if (!imageFiles.length) return;

  const uploadCard = document.querySelector(`#${category} .upload-card`);
  const progress = document.createElement("div");
  progress.className = "progress";
  uploadCard.appendChild(progress);

  for (let i = 0; i < imageFiles.length; i++) {
    progress.textContent = `Uploading ${i + 1} of ${imageFiles.length}...`;
    const compressed = await compressImage(imageFiles[i]);
    await uploadToCloudinary(compressed, category);
  }

  progress.textContent = "Upload complete!";
  setTimeout(() => progress.remove(), 1200);
  await loadGallery(category);
}

function compressImage(file, maxWidth = 1600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(blob), "image/jpeg", quality);
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(fileBlob, category) {
  const tag = makeTag(currentRoom, category);
  const formData = new FormData();
  formData.append("file", fileBlob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `get-set-grow/${currentRoom}/${category}`);
  formData.append("tags", `gsg_gallery,${tag}`);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const response = await fetch(url, { method: "POST", body: formData });
  if (!response.ok) throw new Error("Cloudinary upload failed");
  return response.json();
}

async function loadAllGalleries() {
  if (!currentRoom) return;
  if (!isCloudinaryReady()) {
    updateStatus("Cloudinary not connected. Check config.js.");
    return;
  }
  updateStatus(`Loading ${rooms[currentRoom].title} photos...`);
  await Promise.all(Object.keys(categoryInfo).map(loadGallery));
  updateStatus(`${rooms[currentRoom].title} photos loaded.`);
}

async function loadGallery(category) {
  const tag = makeTag(currentRoom, category);
  const listUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/${tag}.json?ts=${Date.now()}`;
  const section = document.getElementById(category);
  section.querySelectorAll(".cloud-photo, .empty-message").forEach(el => el.remove());

  try {
    const response = await fetch(listUrl);
    if (!response.ok) throw new Error("List not available");
    const data = await response.json();
    const resources = (data.resources || []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    if (!resources.length) {
      addEmptyMessage(section, currentRole === "educator" ? "No photos yet. Add photos above." : "No photos available yet.");
      return;
    }

    resources.forEach(item => {
      const imageUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,w_900,h_700,q_auto,f_auto/${item.public_id}.${item.format}`;
      const fullUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/q_auto,f_auto/${item.public_id}.${item.format}`;
      addPhotoCard(section, imageUrl, fullUrl);
    });
  } catch (error) {
    addEmptyMessage(section, "Photos may upload successfully, but Cloudinary listing is not enabled yet. Enable Resource List in Cloudinary upload settings.");
  }
}

function addPhotoCard(section, imageUrl, fullUrl) {
  const card = document.createElement("article");
  card.className = "photo-card cloud-photo";
  card.innerHTML = `<img src="${imageUrl}" alt="Gallery photo" loading="lazy" draggable="false" onclick="openLightbox('${fullUrl}')"><span class="watermark">Get Set Grow</span>`;
  section.appendChild(card);
}

function addEmptyMessage(section, message) {
  const p = document.createElement("p");
  p.className = "empty-message";
  p.textContent = message;
  section.appendChild(p);
}

function updateStatus(message) {
  const el = document.getElementById("cloudStatus");
  if (el) el.textContent = message;
}

function openLightbox(src) {
  document.getElementById("lightboxImg").src = src;
  document.getElementById("lightbox").classList.remove("hidden");
}

function closeLightbox() {
  document.getElementById("lightbox").classList.add("hidden");
}
