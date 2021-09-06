import {
  createStateChangeMiddleware,
  StateChangeMiddleware,
  StateChangeMiddlewareError
} from '../../src/state/StateChangeMiddleware'
import { createStore, applyMiddleware, Store, AnyAction } from 'redux'

describe('index', () => {
  const reducer = jest.fn((state: any, action: any) => {
    switch (action.type) {
      case 'changeState':
        return {
          ...state,
          ...action.payload
        }
    }
    return state
  })

  let stateChangeMiddleware: StateChangeMiddleware
  let store: Store
  let changeState: <T>(value: T) => AnyAction
  let initialState: any

  beforeEach(() => {
    initialState = { value: 1 }
    stateChangeMiddleware = createStateChangeMiddleware()
    store = createStore(
      reducer,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    )
    expect(store.getState()).toEqual(initialState)
    changeState = value => ({ type: 'changeState', payload: { value } })
  })

  it('Dispatch action when state changes', () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch({ type: 'stateChanged' })

    store.dispatch(changeState(2))

    expect(reducer).toHaveBeenCalledWith(initialState, changeState(2))
    expect(reducer).toHaveBeenCalledWith({ value: 2 }, { type: 'stateChanged' })
  })

  it('Dispatch action when state changes with action creator', () => {
    const actionCreator = (selectedState: any) => {
      return {
        type: 'stateChanged',
        payload: 'CHANGED:' + selectedState
      }
    }
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch(actionCreator)

    store.dispatch(changeState(2))

    expect(reducer).toHaveBeenCalledWith(initialState, changeState(2))
    expect(reducer).toHaveBeenCalledWith({ value: 2 }, { type: 'stateChanged' })
  })
  it('Change state when no change listene is registered', () => {
    store.dispatch(changeState(2))
    expect(reducer).not.toHaveBeenLastCalledWith(
      { value: 2 },
      { type: 'stateChanged' }
    )
  })

  it('Change another part of the state than the change listener is registered to', () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch({ type: 'stateChanged' })

    store.dispatch({ type: 'changeState', payload: { otherValue: 2 } })

    expect(store.getState()).toEqual({ value: 1, otherValue: 2 })
    expect(reducer).not.toHaveBeenCalledWith(
      { value: 1, otherValue: 2 },
      { type: 'stateChanged' }
    )
  })

  it('Limit endless loops', async () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch(value => changeState(value + 1))

    expect(() => store.dispatch(changeState(2))).toThrow(
      StateChangeMiddlewareError
    )
  }, 500)
})
