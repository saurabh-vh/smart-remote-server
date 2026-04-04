import { uiState } from "./state.js";

function setCloseMode() {
  recenterBtn.textContent = "CLOSE";
  recenterBtn.classList.add("close-mode");
}

export const ACTION_CONFIG = {
  eye: {
    command: "toggle_eye",
    payload: (state) => ({ visible: state }),
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
    onTrigger: () => setCloseMode(),
  },
  sitePlan: {
    command: "sitePlan",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  imageGallery: {
    command: "imageGallery",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  presentationVideo: {
    command: "presentationVideo",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  introVideo: {
    command: "introVideo",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  ebrochure: {
    command: "ebrochure",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  siteVisit: {
    command: "siteVisit",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
  },
  emailInfo: {
    command: "emailInfo",
    payload: () => ({}),
    onTrigger: () => setCloseMode(),
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
