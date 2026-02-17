import type { SchemaTable } from "@/lib/sql/introspect";

/**
 * Build the system prompt for Claude that includes the database schema,
 * generation rules, and a curated list of faker.js methods.
 */
export function buildSystemPrompt(schema: SchemaTable[]): string {
  const schemaDescription = schema
    .map((table) => {
      const cols = table.columns
        .map((c) => {
          const flags = [
            c.isPrimaryKey && "PK",
            c.isForeignKey && `FK → ${c.foreignTable}.${c.foreignColumn}`,
            c.nullable && "NULLABLE",
            c.defaultValue && `DEFAULT ${c.defaultValue}`,
          ]
            .filter(Boolean)
            .join(", ");
          return `    ${c.name} ${c.dataType}${flags ? ` (${flags})` : ""}`;
        })
        .join("\n");
      return `  TABLE ${table.name}:\n${cols}`;
    })
    .join("\n\n");

  return `You are a test data generation assistant for a PostgreSQL database. Your job is to create a faker.js configuration that will generate realistic test data based on the user's request.

## Database Schema
${schemaDescription}

## Rules
1. ALWAYS use the generate_data_config tool to return your configuration alongside a brief text explanation.
2. SKIP columns that have default values suggesting auto-generation (SERIAL, nextval(), NOW(), CURRENT_TIMESTAMP, gen_random_uuid()). Do NOT include them in the columns array — Postgres will handle them.
3. For foreign key columns, use the "foreignKey" generator type referencing the parent table and its primary key column.
4. Order tables so parent tables (referenced by FKs) come before child tables in the config.
5. Choose faker.js methods that produce data matching the PostgreSQL column type:
   - integer/bigint/smallint → number.int({ min, max })
   - text/character varying → person.firstName(), lorem.sentence(), etc.
   - timestamp/date → date.recent(), date.past(), date.between({ from, to })
   - boolean → datatype.boolean()
   - numeric/decimal/real/double precision → number.float({ min, max, fractionDigits })
   - uuid → string.uuid()
   - jsonb/json → use a simple object structure
6. Use realistic row counts unless the user specifies exact numbers. Typical defaults: 20-50 for main entities, 2-5x for child/junction tables.
7. For nullable columns where NULLs make sense, set nullProbability between 0.05 and 0.3.
8. Use "oneOf" or "weightedOneOf" for enum-like columns (status, type, category fields).
9. Use "sequence" for integer primary keys that do NOT have a default/serial.
10. Make data realistic and contextually appropriate (e.g., email for email columns, not lorem ipsum).

## Available faker.js methods (use the dot-path as the "method" field)
### Person
- person.firstName, person.lastName, person.fullName
- person.jobTitle, person.jobArea, person.bio
### Internet
- internet.email, internet.url, internet.userName, internet.password
- internet.ipv4, internet.ipv6, internet.userAgent
### Location
- location.streetAddress, location.city, location.state, location.zipCode
- location.country, location.countryCode, location.latitude, location.longitude
### Company
- company.name, company.catchPhrase, company.buzzPhrase
### Commerce
- commerce.productName, commerce.price, commerce.department
- commerce.productDescription
### Finance
- finance.amount (params: { min, max, dec }), finance.currencyCode
- finance.accountNumber, finance.iban
### Date
- date.past (params: { years }), date.recent (params: { days })
- date.future (params: { years }), date.between (params: { from, to })
- date.birthdate (params: { mode, min, max })
### Number
- number.int (params: { min, max }), number.float (params: { min, max, fractionDigits })
### String
- string.uuid, string.alphanumeric (params: { length })
- string.nanoid
### Datatype
- datatype.boolean
### Lorem
- lorem.word, lorem.words, lorem.sentence, lorem.paragraph
### Image
- image.url
### Phone
- phone.number
### Helpers
- helpers.arrayElement (params: pass the array as first arg — use "oneOf" generator instead)`;
}

/**
 * Build the Claude tool_use definition for the data generation config.
 * Uses a flat schema with a type discriminant (Claude handles this better than oneOf).
 */
export function buildToolDefinition() {
  return {
    name: "generate_data_config",
    description:
      "Generate a faker.js data configuration for populating database tables with realistic test data. Returns a structured config that the client-side engine will execute.",
    input_schema: {
      type: "object" as const,
      properties: {
        tables: {
          type: "array",
          description: "Array of table configurations, ordered so parent tables come before child tables",
          items: {
            type: "object",
            properties: {
              tableName: {
                type: "string",
                description: "The database table name",
              },
              rowCount: {
                type: "number",
                description: "Number of rows to generate",
              },
              columns: {
                type: "array",
                description: "Column generation configs. Omit columns with auto-generated defaults (SERIAL, NOW(), etc.)",
                items: {
                  type: "object",
                  properties: {
                    columnName: {
                      type: "string",
                      description: "The column name",
                    },
                    generator: {
                      type: "object",
                      description: "How to generate values for this column",
                      properties: {
                        type: {
                          type: "string",
                          enum: [
                            "faker",
                            "foreignKey",
                            "sequence",
                            "oneOf",
                            "weightedOneOf",
                            "null",
                          ],
                          description:
                            "Generator type: faker (call a faker.js method), foreignKey (reference parent table), sequence (auto-increment), oneOf (pick from list), weightedOneOf (weighted pick), null (always NULL)",
                        },
                        // faker fields
                        method: {
                          type: "string",
                          description: "For type=faker: dot-path to faker method, e.g. 'person.firstName'",
                        },
                        params: {
                          type: "object",
                          description: "For type=faker: optional parameters object passed to the faker method",
                        },
                        // foreignKey fields
                        table: {
                          type: "string",
                          description: "For type=foreignKey: the parent table name",
                        },
                        column: {
                          type: "string",
                          description: "For type=foreignKey: the parent column name (usually the PK)",
                        },
                        // sequence fields
                        start: {
                          type: "number",
                          description: "For type=sequence: starting value (default 1)",
                        },
                        step: {
                          type: "number",
                          description: "For type=sequence: increment per row (default 1)",
                        },
                        // oneOf fields
                        values: {
                          type: "array",
                          description: "For type=oneOf: list of values to pick from uniformly",
                        },
                        // weightedOneOf fields
                        options: {
                          type: "array",
                          description: "For type=weightedOneOf: list of { value, weight } objects",
                          items: {
                            type: "object",
                            properties: {
                              value: {},
                              weight: { type: "number" },
                            },
                            required: ["value", "weight"],
                          },
                        },
                      },
                      required: ["type"],
                    },
                    nullProbability: {
                      type: "number",
                      description: "0-1 probability of generating NULL instead of a value. Only for nullable columns.",
                    },
                  },
                  required: ["columnName", "generator"],
                },
              },
            },
            required: ["tableName", "rowCount", "columns"],
          },
        },
      },
      required: ["tables"],
    },
  };
}
