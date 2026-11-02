import * as React from "react";
import { cn } from "@/lib/utils";

type TableProps = React.ComponentProps<"table"> & {
  /** Props for the scroll container, e.g. a label so keyboard users can scroll it. */
  containerProps?: React.ComponentProps<"div">;
};

function Table({ className, containerProps, ...props }: TableProps) {
  const { className: containerClass, ...rest } = containerProps ?? {};
  return (
    <div data-slot="table-container" className={cn("relative w-full overflow-x-auto", containerClass)} {...rest}>
      <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-[0.95rem]", className)} {...props} />
    </div>
  );
}

function TableHeader(props: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />;
}

function TableBody(props: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-b border-border last:border-b-0", className)} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("px-4 py-4 text-left align-bottom text-sm font-semibold", className)} {...props} />;
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-4 py-4 align-top", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
