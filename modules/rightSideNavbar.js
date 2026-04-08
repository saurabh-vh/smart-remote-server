import { socket } from "./socket.js";
import { remoteState, uiState } from "./state.js";

export function rightSideNavbar(container) {
  const u = uiState.data.moreOptions;

  const icons = [
    {
      action: "eye",
      iconA: "fa-eye",
      iconB: "fa-eye-slash",
      title: "Eye Slash",
      show: true,
    },
    {
      action: "volume",
      iconA: "fa-volume-high",
      iconB: "fa-volume-xmark",
      title: "Volume",
      show: u.has_background_music,
    },
    {
      action: "swimmer",
      icon: "fa-person-swimming",
      title: "Swimmer",
      show: true,
    },
  ];

  container.innerHTML = "";
  icons
    .filter((i) => i.show)
    .forEach((item) => {
      const el = document.createElement("i");
      el.className = `fa-solid ${item.iconA || item.icon}`;
      el.dataset.action = item.action;
      el.title = item.title;
      if (item.iconA) {
        el.dataset.iconA = item.iconA;
        el.dataset.iconB = item.iconB;
      }
      container.appendChild(el);
    });

  // Append Ellipsis wrapper and Iocn
  const wrapper = document.createElement("div");
  wrapper.className = "ellipsis-wrapper";
  wrapper.dataset.action = "ellipsis";
  wrapper.innerHTML = `
    <i class="fa-solid fa-ellipsis-vertical" title="More Options"></i>
    <div class="ellipsis-popup"></div>
  `;
  container.appendChild(wrapper);
}

function showImageGalleryInContent() {
  const container = document.getElementById("contentArea");
  // All left sidebar active menu items deactivate
  document
    .querySelectorAll(".menu-item")
    .forEach((i) => i.classList.remove("active"));

  // Screen overlay hide while clicking on Immage Gallery
  document.getElementById("screenBlurOverlay").classList.remove("active");

  const u = uiState.data.moreOptions;
  const imageData = u.image_gallery || [];

  if (imageData.length > 0) {
    container.innerHTML = `
      <div class="image-wrapper">
        ${imageData
          .map((img, index) => {
            const src = img.image_url || img;
            return `
              <div class="img-box" data-index="${index}">
                <div class="skeleton"></div>
                <img 
                  src="${src}" 
                  class="overlay-img"
                  loading="lazy"
                  decoding="async"
                  onload="this.previousElementSibling.style.display='none'"
                  onerror="this.src='https://picsum.photos/400/300?random=error'; this.previousElementSibling.style.display='none'"
                />
              </div>
            `;
          })
          .join("")}
          
      </div>
    `;

    container.querySelectorAll(".img-box").forEach((box) => {
      box.addEventListener("click", () => {
        container
          .querySelectorAll(".img-box")
          .forEach((b) => b.classList.remove("active"));

        box.classList.add("active");

        socket.emit("remote_command", {
          code: remoteState.pairedCode,
          command: "open_image",
          payload: { index: parseInt(box.dataset.index) },
        });
      });
    });
  } else {
    container.innerHTML = `
      <div class="empty">No images found in gallery</div>
    `;
  }

  // popups close
  document
    .querySelectorAll(".ellipsis-popup")
    .forEach((p) => p.classList.remove("open"));
}

function showScreenOverlay() {
  document.getElementById("screenBlurOverlay").classList.add("active");
  document.getElementById("screenBlurCard").classList.add("visible");
  document
    .querySelectorAll(".ellipsis-popup")
    .forEach((p) => p.classList.remove("open"));
}

export function hideScreenOverlay() {
  document.getElementById("screenBlurOverlay").classList.remove("active");
  document.getElementById("screenBlurCard").classList.remove("visible");
}

export const ACTION_CONFIG = {
  eye: {
    command: "toggle_eye",
    payload: (state) => ({ visible: !state }),
  },
  volume: {
    command: "toggle_volume",
    payload: (state) => ({ muted: state }),
  },
  swimmer: {
    command: "toggle_swimmer",
    payload: () => ({}),
  },
  projectOverview: {
    command: "projectOverview",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  sitePlan: {
    command: "sitePlan",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  imageGallery: {
    command: "imageGallery",
    payload: () => ({}),
    onTrigger: () => showImageGalleryInContent(),
  },
  presentationVideo: {
    command: "presentationVideo",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  introVideo: {
    command: "introVideo",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  ebrochure: {
    command: "ebrochure",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  siteVisit: {
    command: "siteVisit",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
  emailInfo: {
    command: "emailInfo",
    payload: () => ({}),
    onTrigger: () => showScreenOverlay(),
  },
};

export function buildEllipsisPopup(container) {
  const u = uiState.data.moreOptions;
  const items = [
    {
      action: "projectOverview",
      icon: "fa-globe",
      label: "Project Overview",
      show: u.has_project_overview,
    },
    {
      action: "sitePlan",
      icon: "fa-map",
      label: "View Site Plan",
      show: u.has_site_plan,
    },
    {
      action: "imageGallery",
      icon: "fa-panorama",
      label: "Image Gallery",
      show: u.has_image_gallery,
    },
    {
      action: "presentationVideo",
      icon: "fa-tv",
      label: "Presentation Video",
      show: u.has_prsentation_video,
    },
    {
      action: "introVideo",
      icon: "fa-video",
      label: "Intro Video",
      show: u.has_intro_video,
    },
    {
      action: "ebrochure",
      icon: "fa-file-pdf",
      label: "Open E - Brochure",
      show: u.has_e_brochure,
    },
    {
      action: "siteVisit",
      icon: "fa-car-side",
      label: "Schedule a Site Visit",
      show: !u.onsite,
    },
    {
      action: "emailInfo",
      icon: "fa-envelope-circle-check",
      label: "Get Information on Email",
      show: !u.onsite,
    },
  ];

  container.innerHTML = "";
  items
    .filter((item) => item.show)
    .forEach((item) => {
      const div = document.createElement("div");
      div.className = "ellipsis-item";
      div.dataset.action = item.action;
      div.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
      container.appendChild(div);
    });
}
