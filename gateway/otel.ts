import { B3Propagator } from "@opentelemetry/propagator-b3";
import { OTLPExporterNodeBase } from "@opentelemetry/exporter-trace-otlp-http";
import { CompositePropagator } from "@opentelemetry/core";
import {
  ConsoleSpanExporter,
  NoopSpanProcessor,
  SimpleSpanProcessor,
} from "@opentelemetry/tracing";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
// import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { JaegerPropagator } from "@opentelemetry/propagator-jaeger";
import { NodeTracerProvider } from "@opentelemetry/node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { propagation } from "@opentelemetry/api";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { Logger } from "./logger";

// Environment variables taken from:
// https://github.com/open-telemetry/opentelemetry-java/blob/main/sdk-extensions/autoconfigure/README.md

const logger = Logger("open-telemetry");

propagation.setGlobalPropagator(
  new CompositePropagator({
    propagators: [
      // new HttpTraceContextPropagator(), // W3C Propagator
      // new HttpBaggagePropagator(), // OpenTelemetry baggage
      new JaegerPropagator(),
      new B3Propagator(),
    ],
  })
);

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation(), //
    new ExpressInstrumentation(),
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

(function () {
  const tracesExporter = process.env.OTEL_TRACES_EXPORTER;
  let spanExporter = null;
  if (tracesExporter === "logging") {
    spanExporter = new ConsoleSpanExporter();
  } else if (tracesExporter === "otlp") {
    const collectorConfiguration = {};
    // Default trace endpoint is http://localhost:55681/v1/trace
    const collectorEndpoint =
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (collectorEndpoint != null) {
      // @ts-ignore
      collectorConfiguration.url = collectorEndpoint;
    }
    // spanExporter = new CollectorTraceExporter(collectorConfiguration);
  } else if (tracesExporter === "jaeger") {
    const collectorConfiguration = {};
    // Default trace endpoint is http://localhost:14250
    const collectorEndpoint = process.env.OTEL_EXPORTER_JAEGER_ENDPOINT;
    if (collectorEndpoint != null) {
      // @ts-ignore
      collectorConfiguration.endpoint = collectorEndpoint;
    }
    logger.info(`Enabling Jaeger exporter for endpoint ${collectorEndpoint}`);
    // spanExporter = new JaegerExporter();
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
