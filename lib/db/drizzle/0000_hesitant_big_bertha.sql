CREATE TABLE "technicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"specialty" text NOT NULL,
	"phone" text,
	"email" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'media' NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"location" text NOT NULL,
	"department" text,
	"technician_id" integer,
	"technician_name_free" text,
	"notes" text,
	"tipo" text,
	"formato_servico" text,
	"photos" text,
	"signature" text,
	"signed_by" text,
	"signed_at" timestamp,
	"estimated_value" numeric,
	"scheduled_at" timestamp,
	"completed_at" timestamp,
	"unidade" text DEFAULT 'AM' NOT NULL,
	"origem" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_orders_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cpf" text,
	"phone" text,
	"email" text,
	"address" text,
	"birth_date" date,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text,
	"label" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "material_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"unidade" text DEFAULT 'AM' NOT NULL,
	"date" text NOT NULL,
	"tipo_material" text NOT NULL,
	"quantidade" text NOT NULL,
	"justificativa" text NOT NULL,
	"foto" text,
	"tipo" text DEFAULT 'retirada' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"unidade" text DEFAULT 'AM' NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"is_folder" integer DEFAULT 0 NOT NULL,
	"file_data" text,
	"file_type" text,
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
