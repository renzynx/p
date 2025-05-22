import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../ui/pagination";
import { formatDate, formatSize } from "@/lib/utils";
import { toast } from "sonner";
import { FileDeleteDialog } from "./FileDeleteDialog";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { MoreHorizontal, Eye, Download, Trash } from "lucide-react";
import { navigate } from "astro:transitions/client";

type File = {
  id: string;
  name: string;
  size: number;
  type: string;
  user_id: string;
  total_chunks: number;
  created_at: Date;
  updated_at: Date;
  chunks?: Array<{
    id: string;
    file_id: string;
    chunk_number: number;
    url: string;
    url_expiry: Date;
  }>;
};

type FileListProps = {
  files: File[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
};

export const FileList = ({
  files: initialFiles,
  total: initialTotal,
  page,
  limit,
  onPageChange,
}: FileListProps) => {
  // Local state to manage files and total
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [total, setTotal] = useState<number>(initialTotal);

  // Update local state when props change
  useEffect(() => {
    setFiles(initialFiles);
    setTotal(initialTotal);
  }, [initialFiles, initialTotal]);

  const totalPages = Math.ceil(total / limit);

  const handleDelete = async (id: string) => {
    const res = await fetch(`${import.meta.env.PUBLIC_API_URL}/files/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const errorData = await res.json();

      const errorMessage =
        errorData?.message || "Failed to delete file. Please try again.";

      throw new Error(errorMessage);
    }

    const updatedFiles = files.filter((file) => file.id !== id);
    setFiles(updatedFiles);
    setTotal((prev) => prev - 1);
  };

  return (
    <div className="w-full">
      <Table>
        <TableCaption>Your uploaded files</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Chunks</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8">
                No files found. Upload some files to see them here.
              </TableCell>
            </TableRow>
          ) : (
            files.map((file) => (
              <TableRow key={file.id}>
                <TableCell className="font-medium">{file.name}</TableCell>
                <TableCell>{file.type}</TableCell>
                <TableCell>{formatSize(file.size)}</TableCell>
                <TableCell>{file.total_chunks}</TableCell>{" "}
                <TableCell>{formatDate(file.created_at)}</TableCell>
                <TableCell>
                  <div className="flex justify-start">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>{" "}
                        <DropdownMenuItem
                          onClick={() => navigate(`/files/${file.id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(
                              `${import.meta.env.PUBLIC_API_URL}/files/${
                                file.id
                              }/stream`,
                              "_blank"
                            )
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <FileDeleteDialog
                          fileId={file.id}
                          fileName={file.name}
                          onDelete={handleDelete}
                        >
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={(e) => {
                              e.preventDefault();
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </FileDeleteDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={6}>
              Total: {total} file{total !== 1 ? "s" : ""}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className={
                  page <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (pageNum) => (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => onPageChange(pageNum)}
                    isActive={page === pageNum}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                className={
                  page >= totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
};
