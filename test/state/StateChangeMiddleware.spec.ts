import {
  ActionFactory,
  createStateChangeMiddleware,
  StateChangeMiddleware,
  StateChangeMiddlewareError,
  StateSelector,
} from "../../src/state/StateChangeMiddleware";
import {
  createStore as reduxCreateStore,
  applyMiddleware,
  Store,
  AnyAction,
  Reducer,
} from "redux";
import thunkMiddleware, { ThunkAction, ThunkDispatch } from "redux-thunk";

type ThunkStore<S = any, A extends AnyAction = AnyAction> = Store<S, A> & {
  dispatchThunk: ThunkDispatch<S, unknown, A>;
};

const createStore = (
  reducer: Reducer<any, AnyAction>,
  initialState: any,
  stateChangeMiddleware: StateChangeMiddleware
): ThunkStore => {
  const store = reduxCreateStore(
    reducer,
    initialState,
    applyMiddleware(stateChangeMiddleware, thunkMiddleware)
  ) as ThunkStore;
  store.dispatchThunk = store.dispatch;
  return store;
};

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
  let store: ThunkStore;

  beforeEach(() => {
    counterMock = jest.fn(counter);

    stateChangeMiddleware = createStateChangeMiddleware();
    store = createStore(counterMock, initialState, stateChangeMiddleware);

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
    store = createStore(counterMock, initialState, stateChangeMiddleware);
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
    store = createStore(counterMock, initialState, stateChangeMiddleware);
    counterMock.mockClear();

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));
    try {
      store.dispatch(inc(2));
      throw new Error("State change call stack limit should be exceeded");
    } catch (ignoreError: any) {
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

    store = createStore(counterMock, initialState, stateChangeMiddleware);
    counterMock.mockClear();

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch(({ selectedState }) => dec(selectedState));

    try {
      store.dispatch(inc(2));
      throw new Error("State change call stack limit should be exceeded");
    } catch (ignoreError: any) {
      expect(onCallStackLimitExceeded).toHaveBeenCalledTimes(1);
      expect(onCallStackLimitExceeded).toHaveBeenCalledWith(
        [inc(2), dec(2)],
        1
      );
    }
  });

  it("Dispatch action when thunk changes state", () => {
    function doubleInc(value: number) {
      const incValue = value + value;
      return (dispatch: any) => {
        dispatch(inc(incValue));
      };
    }

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch({ type: "text", payload: "changed" });

    store.dispatch(doubleInc(2) as any as AnyAction);

    expect(counterMock).toHaveBeenCalledWith(initialState, inc(4));
    expect(counterMock).toHaveBeenCalledWith(
      { counter: 4, text: "" },
      { type: "text", payload: "changed" }
    );

    expect(store.getState()).toEqual({ counter: 4, text: "Counter changed" });
  });

  it("Dispatch action when async thunk changes state", async () => {
    const delayedInc =
      (value: number): ThunkAction<Promise<void>, any, unknown, AnyAction> =>
      async (dispatch) => {
        return new Promise(function (resolve) {
          setTimeout(() => {
            dispatch(inc(value));
            resolve();
          }, 5);
        });
      };

    stateChangeMiddleware
      .whenStateChanges(counterSelector)
      .thenDispatch({ type: "text", payload: "changed" });

    await store.dispatchThunk(delayedInc(2));

    expect(counterMock).toHaveBeenCalledWith(initialState, inc(2));
    expect(counterMock).toHaveBeenCalledWith(
      { counter: 2, text: "" },
      { type: "text", payload: "changed" }
    );

    expect(store.getState()).toEqual({ counter: 2, text: "Counter changed" });
  });
});
