# Redux Middlewares Library

![GitHub Workflow Status](https://img.shields.io/github/workflow/status/link-intersystems/redux-middlewares/Node.js%20CI)
![Coverage Status](https://coveralls.io/repos/github/link-intersystems/redux-middlewares/badge.svg?branch=master)
![GitHub issues](https://img.shields.io/github/issues-raw/link-intersystems/redux-middlewares)
[![GitHub](https://img.shields.io/github/license/link-intersystems/redux-middlewares?label=license)](LICENSE.md)



A collection of middlewares for Redux. 

## State Change Middleware

The state change middleware allows you to execute reducers as an effect of a state change. It introduces a kind of state listener concept to the Redux store that can be configured with a domain specific language.

    stateChangeMiddleware
      .whenStateChanges((state) => state.counter)
      .thenDispatch({ type: "text", payload: "changed" });

Go to the [state change middleware documentation](src/state/README.md) for details.