import {
  ActionFactory,
  createStateChangeMiddleware,
  StateChangeMiddleware,
  StateChangeMiddlewareError,
  StateSelector,
} from "../../src/state/StateChangeMiddleware";
import { createStore, applyMiddleware, Store } from "redux";

describe("StateChangeMiddleware tests", () => {
  function counter(state: any, action: any) {
    const result = { ...state };
    const { type, payload } = action;

    switch (type) {
      case "inc":
        result.counter = result.counter + payload;
        break;
      case "dec":
        result.counter = result.counter + payload;
        break;
      case "text":
        result.text = "Counter " + payload;
        break;
    }

    return result;
  }

  const counterSelector: StateSelector<any, number> = (state: any) =>
    state.counter;
  const inc = (value: number) => ({ type: "inc", payload: value });
  const dec = (value: number) => ({ type: "dec", payload: value });
  const text = (value: any) => ({ type: "text", payload: value });

  const initialState = { counter: 0, text: "" };

  let counterMock: any;
  let stateChangeMiddleware: StateChangeMiddleware;
  let store: Store;

  beforeEach(() => {
    counterMock = jest.fn(counter);

    stateChangeMiddleware = createStateChangeMiddleware();
    store = createStore(
      counterMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );

    expect(store.getState()).toEqual(initialState);
    counterMock.mockClear();
  });

  it("Dispatch action when state changes", () => {
    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch({ type: "text", payload: "changed" });

    store.dispatch(inc(2));

    expect(counterMock).toHaveBeenCalledWith(initialState, inc(2));
    expect(counterMock).toHaveBeenCalledWith(
      { counter: 2, text: "" },
      { type: "text", payload: "changed" }
    );

    expect(store.getState()).toEqual({ counter: 2, text: "Counter changed" });
  });

  it("Dispatch action when state changes with action creator", () => {
    const actionCreator: ActionFactory<any, number> = ({
      triggerAction,
      selectedState,
    }) => ({
      type: "text",
      payload: triggerAction.type + " " + selectedState,
    });

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(actionCreator);

    store.dispatch(inc(2));

    expect(counterMock).toHaveBeenCalledTimes(2);
    expect(counterMock).toHaveBeenCalledWith(initialState, inc(2));
    expect(counterMock).toHaveBeenCalledWith(
      { counter: 2, text: "" },
      { type: "text", payload: "inc 2" }
    );
  });

  it("Change state when no change listene is registered", () => {
    store.dispatch(inc(2));

    expect(counterMock).toHaveBeenCalledTimes(1);
    expect(counterMock).toHaveBeenCalledWith(initialState, inc(2));
  });

  it("Change another part of the state than the change listener is registered to", () => {
    stateChangeMiddleware
      .whenStateChanges((state: any) => state.value)
      .thenDispatch({ type: "stateChanged" });

    store.dispatch(text("TEST"));

    expect(counterMock).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({ counter: 0, text: "Counter TEST" });
    expect(counterMock).not.toHaveBeenCalledWith(
      { counter: 0, text: "Counter TEST" },
      { type: "stateChanged" }
    );
  });

  it("Limit endless loops", async () => {
    expect(counterMock).toBeCalledTimes(0);

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));

    expect(() => store.dispatch(inc(2))).toThrowError(
      StateChangeMiddlewareError
    );
    expect(counterMock).toBeCalledTimes(21);
  }, 50);

  it("Limit endless loops", async () => {
    expect(counterMock).toBeCalledTimes(0);

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));

    expect(() => store.dispatch(inc(2))).toThrow(StateChangeMiddlewareError);
    expect(counterMock).toBeCalledTimes(21);
  }, 50);

  it("Limit endless loops - no error thrown", async () => {
    counterMock = jest.fn(counter);
    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 1,
      onCallStackLimitExceeded: () => {},
    });
    store = createStore(
      counterMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );
    counterMock.mockClear();

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));

    store.dispatch(inc(2));

    expect(counterMock).toBeCalledTimes(2);
  }, 50);

  it("Limit endless loops - state change dispatches count", () => {
    counterMock = jest.fn(counter);
    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 10,
    });
    store = createStore(
      counterMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );
    counterMock.mockClear();

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));
    try {
      store.dispatch(inc(2));
      throw new Error("State change call stack limit should be exceeded");
    } catch (e: any) {
      expect(counterMock).toHaveBeenCalledTimes(11); // 1 inc(2) + 10 state changes
    }
  }, 50);

  it("State change limit exceeded -> actionStack passed", () => {
    counterMock = jest.fn(counter);
    const onCallStackLimitExceeded = jest.fn();
    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 1,
      onCallStackLimitExceeded,
    });

    store = createStore(
      counterMock,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );
    counterMock.mockClear();

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));

    try {
      store.dispatch(inc(2));
      throw new Error("State change call stack limit should be exceeded");
    } catch (e: any) {
      expect(onCallStackLimitExceeded).toHaveBeenCalledTimes(1);
      expect(onCallStackLimitExceeded).toHaveBeenCalledWith(
        [inc(2), dec(2)],
        1
      );
    }
  });
});
