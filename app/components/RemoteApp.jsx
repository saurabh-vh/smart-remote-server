"use client"
import React, { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { ACTION_CONFIG, buildEllipsisPopup } from './modules/navbarPopupIcons'

export default function RemoteApp(){
  const socketRef = useRef(null)
  const [codeInputs, setCodeInputs] = useState(['','','',''])
  const [pairedCode, setPairedCode] = useState(null)
  const [projectName, setProjectName] = useState(null)
  const [availableDisplays, setAvailableDisplays] = useState([])
  const [remoteState, setRemoteState] = useState(null)
  const [section, setSection] = useState('homes')
  const [stack, setStack] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showRightIcons, setShowRightIcons] = useState(true)

  useEffect(()=>{
    const s = io('http://localhost:3001')
    socketRef.current = s

    s.on('pair_success', ({ code, projectName: projName, displays, moreOptions })=>{
      setPairedCode(code)
      setProjectName(projName)
      setAvailableDisplays(displays || [])
      // build ellipsis popups if any
      setTimeout(()=>document.querySelectorAll('.ellipsis-popup').forEach(p=>buildEllipsisPopup(p)),0)
    })

    s.on('display_state', ({ state })=>{
      setRemoteState(state)
    })

    s.on('second_level_update', ({ selectedUnits = [] })=>{
      setRemoteState(prev=> ({ ...(prev||{}), selectedUnits }))
    })

    s.on('display_list_update', ({ displays })=>{
      setAvailableDisplays(displays || [])
    })

    s.on('pair_error', ({ message })=>{
      alert(message)
      setCodeInputs(['','','',''])
      setPairedCode(null)
    })

    // fetch env and hide icons if not LOCAL
    fetch('http://localhost:3001/env').then(r=>r.json()).then(({ENV_SETUP})=>{
      if (ENV_SETUP !== 'LOCAL') setShowRightIcons(false)
    }).catch(()=>{})

    const handleVisibility = ()=>{ if (document.hidden) unpair() }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', unpair)
    window.addEventListener('beforeunload', unpair)

    return ()=>{
      s.disconnect()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', unpair)
      window.removeEventListener('beforeunload', unpair)
    }
  },[])

  function emit(cmd, payload){
    const s = socketRef.current
    if (!s) return
    s.emit('remote_command', { code: pairedCode, command: cmd, payload })
  }

  function pairWithCode(code){
    const s = socketRef.current
    if (!s) return
    s.emit('pair_remote', { code })
  }

  function unpair(){
    if (!pairedCode) return
    const s = socketRef.current
    if (s) s.emit('remote_command', { code: pairedCode, command: 'remote_disconnected', payload: {} })
    if (s) s.emit('unpair_remote', { code: pairedCode })
    setPairedCode(null)
    setProjectName(null)
    setAvailableDisplays([])
  }

  // navigation helpers
  function navigate(level, id, extra){
    setStack(prev=>[...prev, { level, id, ...(extra||{}) }])
    if (level === 'building'){ setSearchQuery(''); setTypeFilter('') }
  }
  function goBack(){
    setStack(prev=>{
      if (!prev.length) return prev
      const current = prev[prev.length-1]
      let next = prev.slice(0,-1)
      if (current?.level === 'building') next = [...next, { level: 'selectedBuilding', id: current.id }]
      return next
    })
    emit('home_search_back', {})
  }

  // UI handlers
  function onCodeInputChange(idx, val){
    const v = val.replace(/[^0-9]/g,'').slice(0,1)
    setCodeInputs(prev=>{ const next = [...prev]; next[idx]=v; return next })
    if (v && idx < 3){ const inputs = document.querySelectorAll('.code-input'); inputs[idx+1]?.focus() }
    const code = (idx===3) ? null : null
    const full = codeInputs.map((c,i)=> i===idx? v : c).join('')
    if (full.length === 4) pairWithCode(full)
  }

  function onDisplayChange(e){
    const newCode = e.target.value
    if (!newCode || newCode === pairedCode) return
    const s = socketRef.current
    if (s) s.emit('switch_display', { newCode, projectName })
  }

  function handleActionClick(action){
    const config = ACTION_CONFIG[action]
    if (!config) return
    const payload = config.payload ? config.payload() : {}
    emit(config.command, payload)
  }

  // Joystick simplistic implementation — pointer events
  const joystickRef = useRef(null)
  const stickRef = useRef(null)
  useEffect(()=>{
    const joystick = joystickRef.current
    if (!joystick) return
    let dragging = false
    let rect = null
    function start(e){ dragging = true; rect = joystick.getBoundingClientRect() }
    function move(e){ if (!dragging) return; const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; const x = clientX - rect.left - rect.width/2; const y = clientY - rect.top - rect.height/2; const max = 35; const lx = Math.max(-max,Math.min(max,x)); const ly = Math.max(-max,Math.min(max,y)); if (stickRef.current) stickRef.current.style.transform = `translate(calc(-50% + ${lx}px), calc(-50% + ${ly}px))`; if (pairedCode) emit('joystick_move', { type: 'joystick', action: 'move', x: parseFloat((lx/35).toFixed(2)), y: parseFloat((-ly/35).toFixed(2)) }) }
    function end(){ dragging=false; if (stickRef.current) stickRef.current.style.transform = 'translate(-50%, -50%)'; if (pairedCode) emit('joystick_move', { type: 'joystick', action: 'stop', x:0, y:0 }) }
    joystick.addEventListener('pointerdown', start)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    joystick.addEventListener('touchstart', start)
    window.addEventListener('touchmove', move)
    window.addEventListener('touchend', end)
    return ()=>{
      joystick.removeEventListener('pointerdown', start)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      joystick.removeEventListener('touchstart', start)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend', end)
    }
  },[pairedCode])

  // minimal renderers for sections
  function RenderBuildings(){
    const buildings = remoteState?.firstLevelFilter?.selectedBuildings || []
    if (!buildings.length) return <div style={{padding:'10vh',color:'#aaa'}}>Loading buildings...</div>
    return buildings.map((b)=> (
      <div key={b.id} className="list-row" onClick={()=>{ navigate('building', b.id); emit('home_search_filter', { id: b.id }) }}>{b.building_name || `Building ${b.id}`}</div>
    ))
  }

  function RenderUnits(){
    const units = remoteState?.homes?.units || remoteState?.units || []
    const filtered = units.filter(u=> {
      const q = searchQuery.trim().toLowerCase()
      const t = typeFilter.trim().toLowerCase()
      const unitNo = String(u.unique_unit_number || '').toLowerCase()
      const typeLabel = (u.unit_type||'').split('-')[0].trim().toLowerCase()
      return (!q || unitNo.includes(q)) && (!t || typeLabel === t)
    })
    if (!filtered.length) return <div style={{padding:'10vh',color:'#aaa'}}>Loading units...</div>
    return filtered.map(u=> (
      <div key={u.unit_id || u.id} className="list-row unit-row" onClick={()=>{ navigate('unit', u.unit_id); emit('go_to_unit', { unit_id: u.unit_id, unit_number: u.unique_unit_number }); }}>
        <div className="unit-left">{u.unique_unit_number || u.unit_id || u.id || '-'}</div>
        <div className="unit-middle">
          <div className="unit-middle-line unit-area">Area: {u.area_of_unit ?? '-'}</div>
          <div className="unit-middle-line unit-direction">Direction: {u.unit_direction || '-'}</div>
        </div>
        <div className="unit-badge" style={{backgroundColor: u.color_code || '#8a5a00'}}>{(u.unit_type||'').split('-')[0] || 'Unit'}</div>
      </div>
    ))
  }

  function RenderTakeMeTo(){
    const rooms = remoteState?.takeMeTo || []
    if (!rooms.length) return <div style={{padding:'10vh',color:'#aaa'}}>Entering the unit...</div>
    return rooms.map(r=> <div key={r} className="list-row" onClick={()=>{ emit('take_me_to', { room: r }) }}>{r}</div>)
  }

  function RenderAmenities(){
    const list = remoteState?.amenities || []
    if (!list.length) return <div className="empty">No amenities found</div>
    return list.map(a=> <div key={a.id} className="amenity-card" onClick={()=>{ navigate('amenity', a.id); emit('amenity_select', { id: a.id }) }}><div className="amenity-name">{a.amenity_name}</div></div>)
  }

  return (
    <>
      <div className="pair-overlay">
        <div className="pair-box">
          <div>Enter connection code</div>
          <div className="remote-code" id="remoteCodeInputs">
            {codeInputs.map((v, idx)=> (
              <input key={idx} className="code-input" maxLength={1} value={v} onChange={(e)=> onCodeInputChange(idx, e.target.value)} />
            ))}
          </div>
        </div>
      </div>

      <div className="topbar">
        <div className="project-status">
          <div id="projectStatus">{pairedCode ? `Connected to ${projectName || ''}` : 'Not connected'}</div>
          <button className="close-btn" id="closeBtn" aria-label="Close" style={{display: pairedCode ? 'flex' : 'none'}} onClick={unpair}>✕</button>
        </div>
        <select id="displaySelect" className="screen-select" onChange={onDisplayChange} value={pairedCode || ''}>
          <option value="">Select display</option>
          {availableDisplays.map(d=> <option key={d.code} value={d.code}>{d.displayName}</option>)}
        </select>
      </div>

      <div className="main">
        <div className="sidebar">
          <div className="sidebar-header">Remote</div>
          <div className={`menu-item ${section==='homes'?'active':''}`} data-section="homes" onClick={()=>{ setSection('homes'); setStack([]); setSearchQuery(''); setTypeFilter(''); if (socketRef.current) socketRef.current.emit('remote_command', { code: pairedCode, command: 'request_homes' }) }}>Homes Search</div>
          <div className={`menu-item ${section==='amenities'?'active':''}`} data-section="amenities" onClick={()=>{ setSection('amenities'); setStack([]); if (socketRef.current) socketRef.current.emit('remote_command', { code: pairedCode, command: 'request_homes' }) }}>Amenities</div>
          <div className={`menu-item ${section==='location'?'active':''}`} data-section="location" onClick={()=>{ setSection('location'); setStack([]); if (socketRef.current) socketRef.current.emit('remote_command', { code: pairedCode, command: 'request_location' }) }}>Location</div>
        </div>

        <div className="content">
          <div id="contentArea">
            {section==='homes' && (
              <div className="section-card" id="homesView">
                {stack.length===0 && <div>{RenderBuildings()}</div>}
                {stack.length>0 && stack[stack.length-1].level==='building' && (
                  <div>
                    <div className="list-row units-toolbar">
                      <div className="units-back" onClick={goBack}>&larr;</div>
                      <input className="units-search" value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} placeholder="Search unit no." />
                      <select className="units-filter" value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)}>
                        <option value="">All types</option>
                      </select>
                    </div>
                    {RenderUnits()}
                  </div>
                )}
                {stack.length>0 && stack[stack.length-1].level==='unit' && (
                  <div>{RenderTakeMeTo()}</div>
                )}
              </div>
            )}

            {section==='amenities' && (
              <div>
                <div className="section-title">Amenities</div>
                <div className="amenities-grid">{RenderAmenities()}</div>
              </div>
            )}

            {section==='location' && (
              <div className="section-card" style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'10vh',gap:12,color:'#888'}}>
                <div style={{fontSize:32}}>📍</div>
                <div style={{fontSize:16,fontWeight:600,color:'#333'}}>Viewing Location</div>
                <div style={{fontSize:13}}>Controls available on screen</div>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-right" style={{display: showRightIcons ? 'flex' : 'none'}}>
          <i className="fa-solid fa-eye-slash" data-action="eye" onClick={()=>handleActionClick('eye')}></i>
          <i className="fa-solid fa-volume-high" data-action="volume" onClick={()=>handleActionClick('volume')}></i>
          <i className="fa-solid fa-person-swimming" data-action="swimmer" onClick={()=>handleActionClick('swimmer')}></i>
          <div className="ellipsis-wrapper" data-action="ellipsis">
            <i className="fa-solid fa-ellipsis-vertical" onClick={()=>{ const el = document.querySelector('.ellipsis-popup'); el?.classList.toggle('open') }}></i>
            <div className="ellipsis-popup"></div>
          </div>
        </div>

        <div className="joystick-panel">
          <div className="joystick" ref={joystickRef}>
            <div className="joystick-inner" ref={stickRef}><div className="drag-text">MOVE</div></div>
          </div>
        </div>

        <div className="recenter-view-parent">
          <div className="recenter-view" id="recenterBtn" onClick={()=>emit('recenter_view', {})}>RECENTER VIEW</div>
        </div>

        <div className="look-joystick" id="lookJoystick">
          <div className="look-inner" id="lookInner"><div className="drag-text-right">PAN</div></div>
        </div>

        <div className="rubber-band" id="rubberBand">
          <div className="rubber-inner" id="rubberInner"></div>
          <div className="rubber-label">ZOOM</div>
        </div>

      </div>
    </>
  )
}
