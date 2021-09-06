import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from "redux";

export type StateSelector<S, T> = (state: S) => T;

export type ActionFactory<S, T> = (
  selectedState: T,
  state?: S
) => AnyAction | undefined;

export type ActionRef<S, T> = AnyAction | ActionFactory<S, T>;

interface OnStateChange<S, T> {
  thenDispatch(actionRef: ActionRef<S, T>): void;
}

type Dependency = StateDependency<any, any>;
type RegisterDependency = (dependency: Dependency) => void;

class StateDependency<S, T> implements OnStateChange<S, T> {
  private stateSelector: StateSelector<S, T>;
  private actionRef: ActionRef<S, T> = () => undefined;
  private registerDependency: RegisterDependency;

  constructor(
    stateSelector: StateSelector<S, T>,
    registerDependency: RegisterDependency
  ) {
    this.stateSelector = stateSelector;
    this.registerDependency = registerDependency;
  }

  thenDispatch(actionRef: ActionRef<S, T>) {
    this.actionRef = actionRef;
    this.registerDependency(this);
  }

  selectState(state: any) {
    return this.stateSelector(state);
  }

  createAction(state: S, target: T) {
    if (typeof this.actionRef === "function") {
      return this.actionRef(target, state);
    }
    return this.actionRef;
  }
}

export interface StateListener {
  whenStateChanges<S, T>(
    stateSelector: StateSelector<S, T>
  ): OnStateChange<S, T>;
}

class StateListenerRegistry implements StateListener {
  private dependencies: StateDependency<any, any>[] = [];

  private addDependency(dependency: Dependency) {
    this.dependencies.push(dependency);
  }

  whenStateChanges<S, T>(
    stateSelector: StateSelector<S, T>
  ): OnStateChange<S, T> {
    const stateDependency = new StateDependency<S, T>(
      stateSelector,
      this.addDependency.bind(this)
    );
    return stateDependency;
  }

  getTriggers(state: any): StateChangeTrigger[] {
    const stateChangeTriggers = this.dependencies.map((stateDependency) => {
      const stateBefore = stateDependency.selectState(state);
      return new StateChangeTrigger(stateDependency, stateBefore);
    });
    return stateChangeTriggers;
  }
}

class StateChangeTrigger {
  private stateDependency: StateDependency<any, any>;
  private stateBefore: any;

  constructor(stateDependency: StateDependency<any, any>, stateBefore: any) {
    this.stateDependency = stateDependency;
    this.stateBefore = stateBefore;
  }

  getAction(state: any): AnyAction | undefined {
    const stateAfter = this.stateDependency.selectState(state);
    if (this.stateBefore !== stateAfter) {
      return this.stateDependency.createAction(state, stateAfter);
    }
  }
}

export class StateChangeMiddlewareError extends Error {
  constructor(m: string) {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, StateChangeMiddlewareError.prototype);
  }
}

export type StateChangeMiddleware = Middleware<
  {}, // Most middleware do not modify the dispatch return value
  any
> &
  StateListener;

function callStackTemplate(
  maxCallStackDepth: number,
  fn: (
    api: MiddlewareAPI<Dispatch<AnyAction>, any>,
    next: Dispatch<AnyAction>,
    action: AnyAction
  ) => any,
  onCallStackLimitExceeded: (
    maxCallStackDepth: number,
    callStackDepth: number
  ) => void
): StateChangeMiddleware {
  let callStackDepth = 0;

  const template =
    (api: MiddlewareAPI<Dispatch<AnyAction>, any>) =>
    (next: Dispatch<AnyAction>) =>
    (action: AnyAction) => {
      callStackDepth++;
      try {
        if (callStackDepth > maxCallStackDepth) {
          onCallStackLimitExceeded(maxCallStackDepth, callStackDepth);
        } else {
          return fn(api, next, action);
        }
      } finally {
        callStackDepth--;
      }
    };

  return template as StateChangeMiddleware;
}

const undefinedElements = <E>(elem: E | null | undefined): elem is E => {
  return elem != null;
};

const stateChangeMiddleware = (listenerRegistry: StateListenerRegistry) => {
  return (
    store: MiddlewareAPI<Dispatch<AnyAction>, any>,
    next: Dispatch<AnyAction>,
    action: AnyAction
  ) => {
    const stateBefore = store.getState();
    const changeTriggers = listenerRegistry.getTriggers(stateBefore);

    const result = next(action);

    const stateAfter = store.getState();

    const dispatchActions = changeTriggers
      .map((sct) => sct.getAction(stateAfter))
      .filter(undefinedElements);

    dispatchActions.forEach(store.dispatch);

    return result;
  };
};

const onCallStackLimitExceeded = (
  maxCallStackDepth: number,
  callStackDepth: number
) => {
  throw new StateChangeMiddlewareError(
    `Max call stack depth ${maxCallStackDepth} exceeded: ${callStackDepth}`
  );
};

const defaultOptions = {
  maxCallStackDepth: 20,
  onCallStackLimitExceeded,
};

type StateChangeMiddlewareOptions = {
  maxCallStackDepth: number;
  onCallStackLimitExceeded: (
    maxCallStackDepth: number,
    callStackDepth: number
  ) => void;
};

export const createStateChangeMiddleware = (
  options: StateChangeMiddlewareOptions = defaultOptions
): StateChangeMiddleware => {
  const effectiveOptions = { ...defaultOptions, ...options };

  const listenerRegistry = new StateListenerRegistry();

  const middleware = callStackTemplate(
    effectiveOptions.maxCallStackDepth,
    stateChangeMiddleware(listenerRegistry),
    effectiveOptions.onCallStackLimitExceeded
  );

  middleware.whenStateChanges =
    listenerRegistry.whenStateChanges.bind(listenerRegistry);

  return middleware;
};

export default createStateChangeMiddleware;
