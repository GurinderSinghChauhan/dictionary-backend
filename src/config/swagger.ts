import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Dictionary Backend API",
      version: "1.0.0",
      description: "API for dictionary, auth, word lists, and quiz word sets.",
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local",
      },
      {
        url: "https://dictionary-backend-six.vercel.app",
        description: "Production",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/**/*.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
