# State Change Middleware

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/link-intersystems/redux-middlewares/Node.js%20CI)
![Coverage Status](https://coveralls.io/repos/github/link-intersystems/redux-middlewares/badge.svg?branch=master)
![GitHub issues](https://img.shields.io/github/issues-raw/link-intersystems/redux-middlewares)
[![GitHub](https://img.shields.io/github/license/link-intersystems/redux-middlewares?label=license)](LICENSE.md)

The state change middleware allows you to execute reducers as an effect of a state change. It introduces a kind of state listener concept to the Redux store that can be configured with a domain specific language.

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch({ type: "text", payload: "changed" });

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

See the Pen [Example of Redux StateChangeMiddleware by Link Intersystems](https://codepen.io/rene-link/pen/YzQZNYJ) by René Link ([@rene-link](https://codepen.io/rene-link))
on [CodePen](https://codepen.io).

## Install the dependency

    npm i @link-intersystems/redux-middlewares

## Configure the store

    import { createStateChangeMiddleware } from '@link-intersystems/redux-middlewares'
    import { createStore, applyMiddleware } from 'redux'


    const stateChangeMiddleware = createStateChangeMiddleware();

    const initialState = { counter: 0, text: "" };

    store = createStore(
      counter,
      initialState,
      applyMiddleware(stateChangeMiddleware)
    );

## Specify state change actions

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch({ type: "text", payload: "changed" });

This configuration means that whenever the state you selected by `whenStateChanges` the action you define in `thenDispatch` is dispatched.

## Dynamically create dispatch actions

You can also pass an `ActionFactory` function to `thenDispatch`. An `ActionFactory` is simply a function that will be invoked with `ActionFactoryArgs` and returns `AnyAction`.

    export type ActionFactory<S, T> = (
      args: ActionFactoryArgs<S, T>
    ) => AnyAction | undefined;

    export type ActionFactoryArgs<S, T> = {
      selectedState: T;
      state: S;
      triggerAction: AnyAction;
    };

With an `ActionFactory` you can dynamically create actions based on the changed state and/or the trigger action (the action that triggered the state change).

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch(({selectedState, state, triggerAction}) => ({
           type: "text",
           payload: triggerAction.type + " " + selectedState,
        })
      );

In this scenario the `ActionFactory` will be invoked every time the `state.counter` changes and creates an action with the payload `triggerAction.type + " " + selectedState` which will then be dispatched.

## Infinit loop prevention

When you specify state change behavior you can introduce infinit loops. E.g

    stateChangeMiddleware
      .whenStateChanges((state) => state.a)
      .thenDispatch(changeStateB())
      );

    stateChangeMiddleware
      .whenStateChanges((state) => state.b)
      .thenDispatch(changeStateA())
      );

The state change middleware detects those loops by tracking the call stack depth. Per default a call stack depth of 20 state change dispatches is allowed. If you want to change this you can pass a config to the `createStateChangeMiddleware`.

    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 1
    });

If you want to handle the call stack limit exceeded, you can also provide a handle function.

    stateChangeMiddleware = createStateChangeMiddleware({
      maxCallStackDepth: 1,
      onCallStackLimitExceeded: (actionStack, maxCallStackDepth) => {},
    });

Here are the options you can pass to the `createStateChangeMiddleware`.

    export type OnCallStackLimitExceeded = (
      actionStack: AnyAction[],
      maxCallStackDepth: number
    ) => void;

    export type StateChangeMiddlewareOptions = {
      maxCallStackDepth: number;
      onCallStackLimitExceeded?: OnCallStackLimitExceeded;
    };
