// src/components/curriculum/ChapterContentManager.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { _axios } from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, FileText, FileDown, Activity, HelpCircle, Upload, X, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Config } from "@/lib/config";
import { useAuthStore } from "@/store/userAuthStore";

interface Props {
  chapterId: string;
}

type ContentType = "video" | "ppt" | "pdf" | "activity" | "quiz";

interface ContentItem {
  _id: string;
  title: string;
  type: ContentType;
  fileUrl?: string;
  videoUrl?: string;
  isFree: boolean;
  order: number;
}

export function ChapterContentManager({ chapterId }: Props) {
  const [type, setType] = useState<ContentType | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [viewingContent, setViewingContent] = useState<ContentItem | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  const { data: contents = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["chapter-content", chapterId],
    queryFn: async () => {
      const res = await _axios.get(`/admin/curriculum/chapter/${chapterId}/content`);
      return res.data.data || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await _axios.post(
        `/admin/curriculum/chapter/${chapterId}/content`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    },
    onSuccess: () => {
      toast.success("Content uploaded successfully!");
      setFile(null);
      setType("");
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await _axios.delete(`/admin/curriculum/content/${id}`);
    },
    onSuccess: () => {
      toast.success("Content deleted");
      queryClient.invalidateQueries({ queryKey: ["chapter-content", chapterId] });
    },
  });

  const handleUpload = () => {
    if (!file || !type) {
      toast.error("Please select both file type and a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("title", file.name);
    formData.append("isFree", "false");

    uploadMutation.mutate(formData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const maxSize = 100 * 1024 * 1024; // 100MB
      if (selectedFile.size > maxSize) {
        toast.error("File size must be less than 100MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const getContentTypeIcon = (contentType: ContentType) => {
    const icons = {
      video: Video,
      ppt: FileText,
      pdf: FileDown,
      activity: Activity,
      quiz: HelpCircle,
    };
    const IconComponent = icons[contentType] || FileText;
    return <IconComponent className="h-5 w-5 text-blue-600" />;
  };

  const getFileUrl = (item: ContentItem) => {
    const path = item.videoUrl || item.fileUrl || "";
    return path ? `${Config.imgUrl}${path}` : "";
  };

  // If viewing content, show preview
  if (viewingContent) {
    const fileUrl = getFileUrl(viewingContent);

    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setViewingContent(null)}>
          ← Back to Content List
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{viewingContent.title}</CardTitle>
              <Badge variant="outline" className="uppercase">
                {viewingContent.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Video Player */}
            {viewingContent.type === "video" && viewingContent.videoUrl && (
              <div className="space-y-4">
                <video
                  controls
                  className="w-full max-w-4xl rounded-lg shadow-lg"
                  src={fileUrl}
                >
                  Your browser does not support the video tag.
                </video>
                <p className="text-sm text-muted-foreground">
                  📹 Video content - Use player controls to watch
                </p>
              </div>
            )}

            {/* PDF Viewer */}
            {viewingContent.type === "pdf" && viewingContent.fileUrl && (
              <div className="space-y-4">
                <iframe
                  src={fileUrl}
                  className="w-full h-[50vh] sm:h-[500px] md:h-[700px] border rounded-lg shadow-lg"
                  title={viewingContent.title}
                />
                <p className="text-sm text-muted-foreground">
                  📄 PDF document - Scroll to read, use browser zoom if needed
                </p>
              </div>
            )}

            {/* PPT Viewer - Using Google Docs Viewer */}
            {viewingContent.type === "ppt" && viewingContent.fileUrl && (
              <div className="space-y-4">
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                  className="w-full h-[50vh] sm:h-[500px] md:h-[700px] border rounded-lg shadow-lg"
                  title={viewingContent.title}
                />
                <p className="text-sm text-muted-foreground">
                  📊 PowerPoint presentation - Use navigation controls to view slides
                </p>
              </div>
            )}

            {/* Activity/Quiz Viewer - Using Google Docs Viewer */}
            {(viewingContent.type === "activity" || viewingContent.type === "quiz") && viewingContent.fileUrl && (
              <div className="space-y-4">
                <iframe
                  src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                  className="w-full h-[50vh] sm:h-[500px] md:h-[700px] border rounded-lg shadow-lg"
                  title={viewingContent.title}
                />
                <p className="text-sm text-muted-foreground">
                  📝 {viewingContent.type === "quiz" ? "Quiz" : "Activity"} document - View content in the viewer above
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!viewingContent && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Add Chapter Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 max-w-2xl">
              <div className="space-y-2">
                <label className="text-sm font-medium">Content Type</label>
                <Select value={type} onValueChange={(value: ContentType) => setType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Lecture</SelectItem>
                    <SelectItem value="ppt">PPT Slides</SelectItem>
                    <SelectItem value="pdf">PDF Notes</SelectItem>
                    <SelectItem value="activity">Activity Sheet</SelectItem>
                    <SelectItem value="quiz">Quiz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">File</label>
                {!file ? (
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg mb-2">Drop your file here or click to browse</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Supports: MP4, PDF, PPT, DOC, ZIP (Max 100MB)
                    </p>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      accept=".mp4,.pdf,.ppt,.pptx,.doc,.docx,.zip,.webm"
                    />
                    <label htmlFor="file-upload">
                      <Button type="button" variant="outline">
                        Choose File
                      </Button>
                    </label>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={removeFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!file || !type || uploadMutation.isPending}
                className="w-full"
                size="lg"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Content"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing Content</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading content...</div>
          ) : contents.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No content added yet.</p>
          ) : (
            <div className="space-y-4">
              {contents.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      {getContentTypeIcon(item.type)}
                    </div>
                    <div>
                      <h4 className="font-medium">{item.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs uppercase">
                          {item.type}
                        </Badge>
                        {item.isFree && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                            Free Preview
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(item.fileUrl || item.videoUrl) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingContent(item)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this content?")) {
                            deleteMutation.mutate(item._id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}