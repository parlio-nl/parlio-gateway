import { B3Propagator } from "@opentelemetry/propagator-b3";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from "@opentelemetry/core";
import {
  ConsoleSpanExporter,
  NoopSpanProcessor,
  SimpleSpanProcessor,
} from "@opentelemetry/tracing";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { JaegerPropagator } from "@opentelemetry/propagator-jaeger";
import { NodeTracerProvider } from "@opentelemetry/node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { propagation } from "@opentelemetry/api";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Logger } from "./logger";
import { OTLPExporterNodeConfigBase } from "@opentelemetry/exporter-trace-otlp-http/build/src/platform/node/types";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";

// The dotenv.ts loader loads the Pino logger for the first time;
//  we need to reset the logger in order for the PinoInstrumentation to work.
// https://stackoverflow.com/questions/15666144/how-to-remove-module-after-require-in-node-js
delete require.cache[require.resolve("./logger.js")];

// Environment variables taken from:
// https://github.com/open-telemetry/opentelemetry-java/blob/main/sdk-extensions/autoconfigure/README.md

propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [
      new W3CTraceContextPropagator(), // W3C Propagator
      new W3CBaggagePropagator(), // OpenTelemetry baggage
      new JaegerPropagator(),
      new B3Propagator(),
    ],
  })
);

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(), //
    new ExpressInstrumentation(),
    new PinoInstrumentation(),
  ],
});

const tracerProvider = new NodeTracerProvider({
  resource: Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]:
        process.env.OTEL_SERVICE_NAME || "node:unknown_service",
    })
  ),
});

const logger = Logger("otel");

(function () {
  const tracesExporter = process.env.OTEL_TRACES_EXPORTER;
  let spanExporter = null;
  if (tracesExporter === "logging") {
    spanExporter = new ConsoleSpanExporter();
  } else if (tracesExporter === "otlp") {
    const collectorConfiguration: OTLPExporterNodeConfigBase = {};
    // Default trace endpoint is http://localhost:55681/v1/trace
    const collectorEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (collectorEndpoint != null) {
      collectorConfiguration.url = collectorEndpoint;
    }
    spanExporter = new OTLPTraceExporter(collectorConfiguration);
  } else if (tracesExporter === "jaeger") {
    const collectorConfiguration = {};
    // Default trace endpoint is http://localhost:14250
    const collectorEndpoint = process.env.OTEL_EXPORTER_JAEGER_ENDPOINT;
    if (collectorEndpoint != null) {
      // @ts-ignore
      collectorConfiguration.endpoint = collectorEndpoint;
    }
    logger.info(`Enabling Jaeger exporter for endpoint ${collectorEndpoint}`);
    spanExporter = new JaegerExporter();
  } else if (tracesExporter === "none" || tracesExporter == null) {
    logger.warn(`Disabling OpenTelemetry trace exporter`);
    return;
  } else {
    logger.warn(`Unknown OpenTelemetry exporter: ${tracesExporter}`);
    return;
  }

  let spanProcessor;
  if (spanExporter == null) {
    logger.info("Using NoopSpanProcessor");
    spanProcessor = new NoopSpanProcessor();
  } else {
    logger.info(
      `Using SimpleSpanProcessor with ${JSON.stringify(spanExporter)}`
    );
    spanProcessor = new SimpleSpanProcessor(spanExporter);
  }
  tracerProvider.addSpanProcessor(spanProcessor);
})();

tracerProvider.register();
