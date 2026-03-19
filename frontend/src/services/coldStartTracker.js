let state = {
  isColdStarting: false,
  error: null
}

const listeners = new Set()

const notify = () => {
  listeners.forEach(l => l(state))
}

export const coldStartTracker = {
  getState: () => state,
  
  trigger: () => {
    if (!state.isColdStarting) {
      state = { ...state, isColdStarting: true, error: null }
      notify()
    }
  },
  
  complete: () => {
    if (state.isColdStarting || state.error) {
      state = { ...state, isColdStarting: false, error: null }
      notify()
    }
  },
  
  fail: (message) => {
    state = { 
      ...state, 
      isColdStarting: false, 
      error: message || "Le service ne peut pas démarrer. Veuillez réessayer plus tard ou contacter le support." 
    }
    notify()
  },
  
  subscribe: (listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
}
