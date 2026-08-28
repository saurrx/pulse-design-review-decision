import * as React from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto h-full">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm bg-sidebar-background", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b bg-sidebar-background", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0 bg-sidebar-background", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { clickable?: boolean }
>(({ className, clickable = false, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors",
      clickable ? "hover:bg-muted/50 data-[state=selected]:bg-muted cursor-pointer" : "",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-4 text-left align-middle font-medium text-sidebar-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

const StickyTableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & { index?: number }
>(({ className, index = 0, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-4 text-left align-middle font-medium text-sidebar-foreground [&:has([role=checkbox])]:pr-0",
      "sticky text-black bg-photon-light z-20",
      index === 0 ? "left-0" : index === 1 ? "left-[42px]" : "",
      className
    )}
    {...props}
    style={{
      ...(props.style || {}),
      boxShadow: "1px 0 0 0 rgba(0, 0, 0, 0.1)",
      // backgroundColor: "#FFFFFF",
    }}
  />
))
StickyTableHead.displayName = "StickyTableHead"

const StickyTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { index?: number }
>(({ className, index = 0, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0",
      "sticky bg-white z-10",
      index === 0 ? "left-0" : index === 1 ? "left-[42px]" : "",
      className
    )}
    {...props}
    style={{
      ...(props.style || {}),
      boxShadow: "1px 0 0 0 rgba(0, 0, 0, 0.1)",
      backgroundColor: "#FFFFFF",
    }}
  />
))
StickyTableCell.displayName = "StickyTableCell"

const ScrollableTableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { maxHeight?: string; listFormat?: boolean }
>(({ className, children, maxHeight = "70px", listFormat = false, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  >
    <ScrollArea className={cn("h-[70px] w-full rounded-md", className)} style={{ maxHeight }}>
      <div className={cn("p-1 text-sm", listFormat ? "space-y-1" : "")}>
        {listFormat && Array.isArray(children) ? (
          children.map((item, idx) => (
            <div key={idx} className="text-xs border-b border-gray-100 pb-1 last:border-b-0 last:pb-0">
              {item}
            </div>
          ))
        ) : (
          children
        )}
      </div>
    </ScrollArea>
  </td>
))
ScrollableTableCell.displayName = "ScrollableTableCell"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  StickyTableHead,
  StickyTableCell,
  ScrollableTableCell
}
