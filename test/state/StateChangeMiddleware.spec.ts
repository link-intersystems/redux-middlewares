import {
  createStateChangeMiddleware,
  StateChangeMiddleware,
  StateChangeMiddlewareError,
} from "../../src/state/StateChangeMiddleware";
import { createStore, applyMiddleware, Store, AnyAction } from "redux";

describe("StateChangeMiddleware tests", () => {
  const reducer = (state: any, action: any) => {
    switch (action.type) {
      case "changeState":
        return {
          ...state,
          ...action.payload,
        };
    }
    return state;
  };

  const initialState = { value: 1 };

  let reducerMock: any;
  let stateChangeMiddleware: StateChangeMiddleware;
  let store: Store;
  let changeState: <T>(value: T) => AnyAction;

  beforeEach(() => {
    reducerMock = jest.fn(reducer);

    stateChangeMiddleware = createStateChangeMiddleware();
    store = createStore(
      reducerMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );

    expect(store.getState()).toEqual(initialState);
    changeState = (value) => ({ type: "changeState", payload: { value } });
  });

  it("Dispatch action when state changes", () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch({ type: "stateChanged" });

    store.dispatch(changeState(2));

    expect(reducerMock).toHaveBeenCalledWith(initialState, changeState(2));
    expect(reducerMock).toHaveBeenCalledWith(
      { value: 2 },
      { type: "stateChanged" }
    );
  });

  it("Dispatch action when state changes with action creator", () => {
    const actionCreator = (selectedState: any) => {
      return {
        type: "stateChanged",
        payload: "CHANGED:" + selectedState,
      };
    };
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch(actionCreator);

    store.dispatch(changeState(2));

    expect(reducerMock).toHaveBeenCalledWith(initialState, changeState(2));
    expect(reducerMock).toHaveBeenCalledWith(
      { value: 2 },
      { type: "stateChanged", payload: "CHANGED:2" }
    );
  });

  it("Change state when no change listene is registered", () => {
    store.dispatch(changeState(2));
    expect(reducerMock).not.toHaveBeenLastCalledWith(
      { value: 2 },
      { type: "stateChanged" }
    );
  });

  it("Change another part of the state than the change listener is registered to", () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch({ type: "stateChanged" });

    store.dispatch({ type: "changeState", payload: { otherValue: 2 } });

    expect(store.getState()).toEqual({ value: 1, otherValue: 2 });
    expect(reducerMock).not.toHaveBeenCalledWith(
      { value: 1, otherValue: 2 },
      { type: "stateChanged" }
    );
  });

  it("Limit endless loops", async () => {
    expect(reducerMock).toBeCalledTimes(1);

    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch((value) => changeState(value + 1));

    expect(() => store.dispatch(changeState(2))).toThrow(
      StateChangeMiddlewareError
    );
    expect(reducerMock).toBeCalledTimes(21);
  }, 50);
  it("Limit endless loops - no error thrown", async () => {
    reducerMock = jest.fn(reducer);
    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 2,
      onCallStackLimitExceeded: () => {},
    });
    store = createStore(
      reducerMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );

    expect(reducerMock).toBeCalledTimes(1);

    stateChangeMiddleware
      .whenStateChanges((state: any) => state?.value)
      .thenDispatch((value) => changeState(value + 1));

    store.dispatch(changeState(2));

    expect(reducerMock).toBeCalledTimes(3);
  }, 50);
});
