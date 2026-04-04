export const ACTION_CONFIG = {
  eye: { command: 'toggle_eye', payload: (state)=>({ state }) },
  volume: { command: 'toggle_volume', payload: (state)=>({ state }) },
  maximize: { command: 'toggle_maximize', payload: ()=>({}) },
  ellipsis: { command: 'ellipsis', payload: ()=>({}) },
  swimmer: { command: 'swimmer', payload: ()=>({}) }
}

export function buildEllipsisPopup(popupEl){
  // Minimal popup builder: add a placeholder action
  if (!popupEl) return
  popupEl.innerHTML = ''
  const btn = document.createElement('button')
  btn.textContent = 'More'
  btn.onclick = ()=>{ popupEl.classList.remove('open') }
  popupEl.appendChild(btn)
}
