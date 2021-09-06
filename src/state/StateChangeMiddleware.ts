import { AnyAction, Middleware } from "redux";

export type StateSelector<S, T> = (state: S) => T;

export type ActionFactory<S, T> = (
  selectedState: T,
  state?: S
) => AnyAction | undefined;

export type ActionRef<S, T> = AnyAction | ActionFactory<S, T>;

interface OnStateChange<S, T> {
  thenDispatch(actionRef: ActionRef<S, T>): void;
}

class StateDependency<S, T> implements OnStateChange<S, T> {
  private stateSelector: StateSelector<S, T>;
  private actionRef: ActionRef<S, T> = () => undefined;
  private dependencyRegistrar: DependencyRegistrar;

  constructor(
    stateSelector: StateSelector<S, T>,
    dependencyRegistrar: DependencyRegistrar
  ) {
    this.stateSelector = stateSelector;
    this.dependencyRegistrar = dependencyRegistrar;
  }

  thenDispatch(actionRef: ActionRef<S, T>) {
    this.actionRef = actionRef;
    this.dependencyRegistrar(this);
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
type Dependency = StateDependency<any, any>;
type DependencyRegistrar = (dependency: Dependency) => void;

export interface StateChangeComponent {
  stateListener: StateListener;
  stateChangeMiddleware: Middleware<{}, any>;
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

export type StateChangeMiddleware = Middleware<
  {}, // Most middleware do not modify the dispatch return value
  any
> &
  StateListener;

export class StateChangeMiddlewareError extends Error {
  constructor(m: string) {
    super(m);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, StateChangeMiddlewareError.prototype);
  }
}

const undefinedElements = <E>(elem: E | null | undefined): elem is E => {
  return elem != null;
};

const defaultOptions = {
  maxCallStackDepth: 20,
};

export const createStateChangeMiddleware = (
  options = defaultOptions
): StateChangeMiddleware => {
  const listenerRegistry = new StateListenerRegistry();

  const effectiveOptions = { ...defaultOptions, ...options };

  const maxCallStackDepth = effectiveOptions.maxCallStackDepth;
  let callStackDepth = 0;

  const stateChangeMiddleware: StateChangeMiddleware =
    (store) => (next) => (action) => {
      callStackDepth++;
      try {
        if (callStackDepth > maxCallStackDepth) {
          throw new StateChangeMiddlewareError(
            `Max call stack depth ${maxCallStackDepth} exceeded: ${callStackDepth}`
          );
        }

        const stateBefore = store.getState();
        const changeTriggers = listenerRegistry.getTriggers(stateBefore);

        const result = next(action);

        const stateAfter = store.getState();

        const dispatchActions = changeTriggers
          .map((sct) => sct.getAction(stateAfter))
          .filter(undefinedElements);

        dispatchActions.forEach((a) => store.dispatch(a));

        return result;
      } finally {
        callStackDepth--;
      }
    };

  stateChangeMiddleware.whenStateChanges =
    listenerRegistry.whenStateChanges.bind(listenerRegistry);

  return stateChangeMiddleware;
};

export default createStateChangeMiddleware;
