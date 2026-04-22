export const remoteState = {
  pairedCode: null,
};

export const uiState = {
  // ================================
  // GLOBAL NAVIGATION STATE
  // ================================
  section: "homes",
  stack: [],
  searchQuery: "",
  typeFilter: "",

  // ================================
  // SERVER / SOCKET DATA
  // (populated via display_state socket event)
  // ================================
  data: {
    homes: { buildings: [], units: [] },
    takeMeTo: [],
    amenities: {},
    locationData: [],
    locationPlacesFind: [],
    autocompletePredictions: [],
    moreOptions: {},
    joystickPosition: true,
  },

  // ================================
  // UI / LOCAL SECTION STATE
  // (module-level UI state, reset on section change)
  // ================================
  ui: {
    location: {
      activePlaceName: null,
      activeSubPlaceId: null,
      dropdownDismissed: false,
    },
  },
};

// ================================
// Defines reset logic for each section.
// Add a new entry here when a new section is introduced.
// Called automatically when user navigates away from a section.
// ================================
const SECTION_RESETS = {
  location: () => {
    uiState.ui.location.activePlaceName = null;
    uiState.ui.location.activeSubPlaceId = null;
    uiState.ui.location.dropdownDismissed = false;
    uiState.ui.location.locationData = [];
    uiState.ui.location.locationPlacesFind = [];
    uiState.ui.location.autocompletePredictions = [];
  },
};

// ================================
// Resets the state of the section being left.
// Must be called BEFORE uiState.section is updated.
// @param {string} leavingSection - Section the user is navigating away from
// ================================
export function resetSectionState(leavingSection) {
  SECTION_RESETS[leavingSection]?.();
  console.log(leavingSection);
}
