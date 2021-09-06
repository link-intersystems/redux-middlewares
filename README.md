![GitHub Workflow Status](https://img.shields.io/github/workflow/status/link-intersystems/redux-middlewares/Node.js%20CI)
![Coverage Status](https://coveralls.io/repos/github/link-intersystems/redux-middlewares/badge.svg?branch=master)

# Redux Middlewares Library

A collection of middlewares for Redux.

## State Change Middleware

The state change middleware allows you to execute reducers as an effect of a state change. It introduces a kind of state listener concept to the Redux store that can be configured with a domain specific language.

Let's assume you have a counter reducer

    function counter(state: any, action: any) {
      const result = { ...state };
      const {type, payload} = action;

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

and you want the text to be updated whenever the couner value is modified. You can then use the state change middleware.

First you need to configure your store to use the state change middleware.

    const stateChangeMiddleware = createStateChangeMiddleware();

    store = createStore(
      counter,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );

Then you can specify the state listeners.

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch({ type: "text", payload: "changed" });

So whenever the state you selected by `whenStateChanges` the action you define will be dispatched.

### Dynamically create dispatch actions

You can also pass a action factory function to the `thenDispatch`. An `ActionFactory` is simply a function that will be invoked with an `ActionFactoryArgs` and returns `AnyAction`.

    export type ActionFactory<S, T> = (
      args: ActionFactoryArgs<S, T>
    ) => AnyAction | undefined;

    export type ActionFactoryArgs<S, T> = {
      selectedState: T;
      state: S;
      triggerAction: AnyAction;
    };

Using an `ActionFactory` you can dynamically create actions based on the changed state.

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch(({selectedState, state, triggerAction}) => ({
           type: "text",
           payload: triggerAction.type + " " + selectedState,
        })
      );

In this scenario the `ActionFactory` will be invoked every time the `state.counter` changes and the created action will be dispatched.
