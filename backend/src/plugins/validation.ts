/**
 * Strict JSON-body validation compiler for Fastify.
 *
 * Fastify's default AJV config enables `coerceTypes: 'array'` everywhere, which
 * is needed for HTTP `params`, `querystring`, and `headers` (always strings on
 * the wire), but silently coerces invalid JSON body values such as
 * `{ lat: null, lon: null }` into `{ lat: 0, lon: 0 }` or `"10"` into `10`.
 *
 * This schemaController keeps Fastify's defaults for `params`, `querystring`,
 * and `headers` while setting `coerceTypes: false` exclusively for `body`.
 */

import { createRequire } from 'node:module';
import type { FastifyServerOptions } from 'fastify';

type SchemaController = NonNullable<FastifyServerOptions['schemaController']>;
type BuildValidator = NonNullable<
  NonNullable<SchemaController['compilersFactory']>['buildValidator']
>;

interface RouteSchemaInput {
  schema: unknown;
  method?: string;
  url?: string;
  httpPart?: string;
}

interface AjvBuildOptions {
  customOptions?: Record<string, unknown>;
  plugins?: unknown[];
}

type CompileRouteSchema = (routeSchema: RouteSchemaInput) => unknown;
type AjvValidatorBuilder = (
  externalSchemas: Record<string, unknown>,
  ajvOptions: AjvBuildOptions,
) => CompileRouteSchema;

const require = createRequire(import.meta.url);
const AjvCompiler = require('@fastify/ajv-compiler') as () => AjvValidatorBuilder;

export function createStrictBodySchemaController(): SchemaController {
  const ajvFactory = AjvCompiler();

  const buildValidator: AjvValidatorBuilder = (externalSchemas, ajvOptions) => {
    const defaultCompiler = ajvFactory(externalSchemas, ajvOptions);
    const bodyCompiler = ajvFactory(externalSchemas, {
      ...ajvOptions,
      customOptions: {
        ...ajvOptions?.customOptions,
        coerceTypes: false,
      },
    });

    return (routeSchema) => {
      if (routeSchema.httpPart === 'body') {
        return bodyCompiler(routeSchema);
      }
      return defaultCompiler(routeSchema);
    };
  };

  return {
    compilersFactory: {
      buildValidator: buildValidator as unknown as BuildValidator,
    },
  };
}
