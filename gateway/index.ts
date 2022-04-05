// ==== [ OpenTelemetry must come first ] ====
import "./otel";
// ==== [ OpenTelemetry must come first ] ====

import { ApolloServer } from "apollo-server-express";
import { ApolloGateway, RemoteGraphQLDataSource } from "@apollo/gateway";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageDisabled,
} from "apollo-server-core";
import { readFileSync } from "fs";
import fetch from "make-fetch-happen";
import { Logger } from "./logger";
import { Logger as ApolloLogger } from "apollo-server-types";
import express from "express";
import expressPinoLogger from "pino-http";
import * as http from "http";

const logger = Logger("main");

const app = express();
app.disable("x-powered-by");
app.use(
  expressPinoLogger({
    logger: Logger("express"),
    serializers: {
      req: function (req: any) {
        return {
          ...req,
          headers: {
            ...req.headers,
            cookie: req.headers.cookie ? "---" : undefined,
          },
        };
      },
    },
  })
);

function getEnvironment(): string {
  return process.env.NODE_ENV || "development";
}

let superGraphFilePath = `./rover/supergraphs/supergraph-${getEnvironment()}.graphql`;
logger.info(`Supergraph schema path: ${superGraphFilePath}`);
const supergraphSchema = readFileSync(superGraphFilePath).toString();
const isProduction = getEnvironment() === "production";

function apolloLoggingFacade(name: string): ApolloLogger {
  const delegate = Logger(name);
  return {
    debug: (msg) => delegate.debug(msg),
    info: (msg) => delegate.info(msg),
    warn: (msg) => delegate.warn(msg),
    error: (msg) => delegate.error(msg),
  };
}

const exposeQueryPlan = !isProduction && false;
if (exposeQueryPlan) {
  logger.info(
    "Exposing query plan (when Apollo-Query-Plan-Experimental header is set)"
  );
}

type ParlioGatewayRequestContext = {
  auth: string | undefined;
};

const httpServer = http.createServer(app);

const gateway = new ApolloGateway({
  logger: apolloLoggingFacade("apollo-gateway"),
  supergraphSdl: supergraphSchema,
  __exposeQueryPlanExperimental: exposeQueryPlan,
  debug: !isProduction,
  buildService({ name, url }) {
    logger.info(`Routing '${name}' traffic to ${url}`);
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest(gatewayRequest) {
        const context: ParlioGatewayRequestContext = <
          ParlioGatewayRequestContext
        >gatewayRequest.context;
        const auth = context.auth;
        if (auth) {
          gatewayRequest.request.http?.headers.set("Authorization", auth);
        }
      },
      fetcher(input, init) {
        const timeout = 3000;
        if (init) {
          init.timeout = timeout;
        } else {
          init = { timeout: timeout };
        }
        return fetch(input, init);
      },
    });
  },
});

const server = new ApolloServer({
  logger: apolloLoggingFacade("apollo-server"),
  gateway,
  debug: true,
  introspection: true,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    ApolloServerPluginLandingPageDisabled(), // No landing page
  ],
  context: ({ req }): ParlioGatewayRequestContext => {
    const auth = req.headers.authorization;
    return {
      auth,
    };
  },
});

(async function () {
  await server.start();

  server.applyMiddleware({
    app,
    cors: {
      methods: [
        "OPTIONS", // OPTIONS is required because of fetch
        "POST",
        "GET",
      ],
      origin: "*",
    },
  });

  await new Promise<void>((resolve) => {
    httpServer.listen({ port: 4000 }, resolve);
  });
  logger.info(`Server ready at ${server.graphqlPath}`);
})();
