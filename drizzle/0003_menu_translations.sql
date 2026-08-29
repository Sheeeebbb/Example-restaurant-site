CREATE TABLE "category_translations" (
	"category_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text,
	"description" text,
	CONSTRAINT "category_translations_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "menu_item_translations" (
	"menu_item_id" text NOT NULL,
	"locale" text NOT NULL,
	"name" text,
	"description" text,
	CONSTRAINT "menu_item_translations_menu_item_id_locale_pk" PRIMARY KEY("menu_item_id","locale")
);
--> statement-breakpoint
ALTER TABLE "category_translations" ADD CONSTRAINT "category_translations_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_translations" ADD CONSTRAINT "menu_item_translations_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;