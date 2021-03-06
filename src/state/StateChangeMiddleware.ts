import { AnyAction, Dispatch, Middleware, MiddlewareAPI } from "redux";

export type StateSelector<S, T> = (state: S) => T;

export type ActionFactoryArgs<S, T> = {
  selectedState: T;
  state: S;
  triggerAction: AnyAction;
};

export type ActionFactory<S, T> = (
  args: ActionFactoryArgs<S, T>
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

  createAction(state: S, target: T, triggerAction: AnyAction) {
    if (typeof this.actionRef === "function") {
      return this.actionRef({ selectedState: target, state, triggerAction });
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

  getDispatchAction(
    state: any,
    triggerAction: AnyAction
  ): AnyAction | undefined {
    const stateAfter = this.stateDependency.selectState(state);
    if (this.stateBefore !== stateAfter) {
      return this.stateDependency.createAction(
        state,
        stateAfter,
        triggerAction
      );
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
  onCallStackLimitExceeded: OnCallStackLimitExceeded
): StateChangeMiddleware {
  let actions: AnyAction[] = [];

  const template =
    (api: MiddlewareAPI<Dispatch<AnyAction>, any>) =>
    (next: Dispatch<AnyAction>) =>
    (action: AnyAction) => {
      if (actions.length <= maxCallStackDepth) {
        try {
          actions.push(action);
          return fn(api, next, action);
        } finally {
          actions.pop();
        }
      } else {
        try {
          onCallStackLimitExceeded([...actions], maxCallStackDepth);
        } finally {
          actions = [];
        }
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
      .map((sct) => sct.getDispatchAction(stateAfter, action))
      .filter(undefinedElements);

    dispatchActions.forEach(store.dispatch);

    return result;
  };
};

const defaultOnCallStackLimitExceeded = (
  actionStack: AnyAction[],
  maxCallStackDepth: number
) => {
  throw new StateChangeMiddlewareError(
    `Max call stack depth ${maxCallStackDepth} exceeded: ${actionStack}`
  );
};

const defaultOptions = {
  maxCallStackDepth: 20,
  onCallStackLimitExceeded: defaultOnCallStackLimitExceeded,
};

export type OnCallStackLimitExceeded = (
  actionStack: AnyAction[],
  maxCallStackDepth: number
) => void;

export type StateChangeMiddlewareOptions = {
  maxCallStackDepth: number;
  onCallStackLimitExceeded?: OnCallStackLimitExceeded;
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
