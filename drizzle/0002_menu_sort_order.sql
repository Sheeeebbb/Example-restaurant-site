ALTER TABLE "menu_items" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "menu_items_sort_idx" ON "menu_items" USING btree ("sort_order");