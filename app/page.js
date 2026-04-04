import RemoteClient from './components/RemoteClient'

export default function Page(){
  return (
    <>
      <div className="app" id="app">
        <div className="pair-overlay">
          <div className="pair-box">
            <div>Enter connection code</div>
            <div className="remote-code" id="remoteCodeInputs">
              <input className="code-input" maxLength={1} />
              <input className="code-input" maxLength={1} />
              <input className="code-input" maxLength={1} />
              <input className="code-input" maxLength={1} />
            </div>
          </div>
        </div>

        <div className="topbar">
          <div className="project-status">
            <div id="projectStatus">Not connected</div>
            <button className="close-btn" id="closeBtn" aria-label="Close" style={{display:'none'}}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <select id="displaySelect" className="screen-select"></select>
        </div>

        <div className="mobile-icons"></div>

        <div className="main">
          <div className="sidebar">
            <div className="sidebar-header">Remote</div>
            <div className="menu-item active" data-section="homes">Homes Search</div>
            <div className="menu-item" data-section="amenities">Amenities</div>
            <div className="menu-item" data-section="location">Location</div>
          </div>

          <div className="content">
            <div id="contentArea"></div>
          </div>

          <div className="sidebar-right">
            <i className="fa-solid fa-eye-slash" data-action="eye" data-icon-a="fa-eye-slash" data-icon-b="fa-eye" title="Eye Slash"></i>
            <i className="fa-solid fa-volume-high" data-action="volume" data-icon-a="fa-volume-high" data-icon-b="fa-volume-xmark" title="Volume High"></i>
            <i className="fa-solid fa-person-swimming" data-action="swimmer" title="Swimmer"></i>
            <div className="ellipsis-wrapper" data-action="ellipsis">
              <i className="fa-solid fa-ellipsis-vertical" title="More Options"></i>
              <div className="ellipsis-popup" id="ellipsisPopup"></div>
            </div>
          </div>

          <div className="joystick-panel">
            <div className="joystick">
              <div className="joystick-inner">
                <div className="drag-text">MOVE</div>
              </div>
              <div className="arrow up"></div>
              <div className="arrow down"></div>
              <div className="arrow left"></div>
              <div className="arrow right"></div>
            </div>
          </div>

          <div className="recenter-view-parent">
            <div className="recenter-view" id="recenterBtn">RECENTER VIEW</div>
          </div>

          <div className="look-joystick" id="lookJoystick">
            <div className="look-inner" id="lookInner">
              <div className="drag-text-right">PAN</div>
            </div>
          </div>

          <div className="rubber-band" id="rubberBand">
            <div className="rubber-inner" id="rubberInner"></div>
            <div className="rubber-label">ZOOM</div>
          </div>

        </div>
      </div>

      <RemoteClient />
    </>
  )
}
