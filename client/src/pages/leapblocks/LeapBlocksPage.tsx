import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { _axios } from '@/lib/axios';
import { useAuthStore } from '@/store/userAuthStore';
import { Config } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, RefreshCw, Download, Layers, Calendar, Terminal } from 'lucide-react';

interface LeapBlocksVersion {
  id: string;
  version: string;
  exeUrl: string;
  blockmapUrl: string | null;
  latestYmlUrl: string | null;
  sha512: string | null;
  isLatest: boolean;
  releaseNotes: string | null;
  createdAt: string;
}

export default function LeapBlocksPage() {
  const user = useAuthStore((s) => s.user);
  const [versions, setVersions] = useState<LeapBlocksVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Upload States
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  
  // Parsed ZIP Contents
  const [zipFiles, setZipFiles] = useState<{ name: string; size: number }[]>([]);
  const [parsedVersion, setParsedVersion] = useState<string>('');
  const [parsedExeName, setParsedExeName] = useState<string>('');
  const [parsedSha512, setParsedSha512] = useState<string>('');
  const [releaseNotes, setReleaseNotes] = useState<string>('');
  
  // Extracted binary blobs
  const extractedFilesRef = useRef<{
    exeBlob: Blob | null;
    exeName: string;
    latestYmlText: string;
    blockmapBlob: Blob | null;
    blockmapName: string;
  }>({
    exeBlob: null,
    exeName: '',
    latestYmlText: '',
    blockmapBlob: null,
    blockmapName: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unauthorized page block
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Access Denied</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          You do not have the required permissions to access the LeapBlocks version management console.
        </p>
      </div>
    );
  }

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const response = await _axios.get('/admin/leapblocks/versions');
      if (response.data?.success) {
        setVersions(response.data.data || []);
      } else {
        toast.error('Failed to load version history');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Error connecting to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  // Simple key-value parser for latest.yml
  const parseYml = (ymlText: string) => {
    const lines = ymlText.split('\n');
    let version = '';
    let exePath = '';
    let sha512 = '';

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      const key = line.slice(0, colonIndex).trim();
      const val = line.slice(colonIndex + 1).trim();

      if (key === 'version') {
        version = val.replace(/['"]/g, '');
      } else if (key === 'path') {
        exePath = val.replace(/['"]/g, '');
      } else if (key === 'sha512') {
        sha512 = val.replace(/['"]/g, '');
      }
    }
    return { version, exePath, sha512 };
  };

  const handleZipFile = async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Please upload a valid ZIP file of the "out" folder.');
      return;
    }

    setExtracting(true);
    setZipFiles([]);
    setParsedVersion('');
    setParsedExeName('');
    setParsedSha512('');

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      const filesList: { name: string; size: number }[] = [];
      let latestYmlFile: any = null;
      let exeFile: any = null;
      let blockmapFile: any = null;

      // Find files inside the zip
      contents.forEach((_relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        
        // Push to display list
        filesList.push({
          name: zipEntry.name,
          size: (zipEntry as any)._data?.uncompressedSize || 0
        });

        // We check for files at root or inside an "out" folder in the zip
        const lowerName = zipEntry.name.toLowerCase();
        if (lowerName.endsWith('latest.yml')) {
          latestYmlFile = zipEntry;
        } else if (lowerName.endsWith('.exe')) {
          exeFile = zipEntry;
        } else if (lowerName.endsWith('.blockmap')) {
          blockmapFile = zipEntry;
        }
      });

      setZipFiles(filesList);

      if (!latestYmlFile) {
        throw new Error('Could not find latest.yml in the ZIP folder.');
      }
      if (!exeFile) {
        throw new Error('Could not find installer (.exe) in the ZIP folder.');
      }

      // Read latest.yml
      const latestYmlText = await latestYmlFile.async('text');
      const { version, exePath, sha512 } = parseYml(latestYmlText);

      if (!version) {
        throw new Error('Could not parse version from latest.yml');
      }

      setParsedVersion(version);
      setParsedExeName(exePath || exeFile.name);
      setParsedSha512(sha512);

      // Extract actual binary files
      toast.loading('Extracting setup files in memory...', { id: 'zip-extract' });
      
      const exeBlob = await exeFile.async('blob');
      
      let blockmapBlob: Blob | null = null;
      if (blockmapFile) {
        blockmapBlob = await blockmapFile.async('blob');
      }

      extractedFilesRef.current = {
        exeBlob,
        exeName: exePath || exeFile.name,
        latestYmlText,
        blockmapBlob,
        blockmapName: blockmapFile ? blockmapFile.name : ''
      };

      toast.success('ZIP parsed and verified successfully!', { id: 'zip-extract' });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error parsing ZIP archive', { id: 'zip-extract' });
      extractedFilesRef.current = {
        exeBlob: null,
        exeName: '',
        latestYmlText: '',
        blockmapBlob: null,
        blockmapName: ''
      };
    } finally {
      setExtracting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleZipFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleZipFile(e.target.files[0]);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const { exeBlob, latestYmlText, blockmapBlob, exeName, blockmapName } = extractedFilesRef.current;

    if (!exeBlob || !latestYmlText || !parsedVersion) {
      toast.error('No valid build files extracted. Please upload a ZIP archive first.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('version', parsedVersion);
    formData.append('releaseNotes', releaseNotes);
    formData.append('latestYml', latestYmlText);
    formData.append('file', exeBlob, exeName);
    
    if (blockmapBlob) {
      formData.append('blockmap', blockmapBlob, blockmapName);
    }

    try {
      const response = await _axios.post('/admin/leapblocks/versions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || 1;
          const current = progressEvent.loaded;
          const percent = Math.round((current * 100) / total);
          setUploadProgress(percent);
        }
      });

      if (response.data?.success) {
        toast.success(`LeapBlocks v${parsedVersion} published successfully!`);
        // Reset states
        setParsedVersion('');
        setParsedExeName('');
        setParsedSha512('');
        setZipFiles([]);
        setReleaseNotes('');
        extractedFilesRef.current = {
          exeBlob: null,
          exeName: '',
          latestYmlText: '',
          blockmapBlob: null,
          blockmapName: ''
        };
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchVersions();
      } else {
        toast.error(response.data?.message || 'Publishing failed');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error publishing version to server');
    } finally {
      setUploading(false);
    }
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getFullDownloadUrl = (path: string) => {
    if (!path) return '';
    // Resolve relative download path from local proxy
    const host = Config.baseUrl.replace(/\/api$/, '');
    return `${host}${path}`;
  };

  return (
    <div className="py-10 px-5 sm:px-8 max-w-screen-2xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">LeapBlocks Releases</h1>
          <p className="text-muted-foreground mt-1">
            Manage auto-update builds, upload installers, and monitor client versions.
          </p>
        </div>
        <Button onClick={fetchVersions} variant="outline" size="sm" className="gap-2 self-start md:self-center">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh History
        </Button>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Panel */}
        <Card className="lg:col-span-1 shadow-lg border-muted">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-indigo-500" />
              Publish New Version
            </CardTitle>
            <CardDescription>
              Zip the entire "out" folder from electron-builder and upload it here.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 relative flex flex-col items-center justify-center min-h-[180px]
                ${dragActive 
                  ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]' 
                  : 'border-muted-foreground/30 hover:border-indigo-400 hover:bg-muted/50'
                }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
                disabled={extracting || uploading}
              />
              
              {extracting ? (
                <>
                  <RefreshCw className="h-10 w-10 text-indigo-500 animate-spin mb-4" />
                  <p className="font-semibold text-foreground text-sm">Extracting ZIP Archive...</p>
                  <p className="text-xs text-muted-foreground mt-1">Processing file index in memory</p>
                </>
              ) : (
                <>
                  <UploadCloud className="h-10 w-10 text-muted-foreground group-hover:text-indigo-400 mb-4 transition-colors" />
                  <p className="font-semibold text-foreground text-sm">Drag & Drop out.zip here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
                  <p className="text-[10px] text-muted-foreground mt-3 uppercase tracking-wider bg-muted px-2 py-0.5 rounded">Zip folder format</p>
                </>
              )}
            </div>

            {/* Parsed Metadata Output */}
            {parsedVersion && (
              <form onSubmit={handlePublish} className="space-y-5 p-4 rounded-xl bg-muted/40 border border-muted page-enter">
                <div className="flex items-center justify-between border-b pb-2 mb-2">
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Archive Verified
                  </span>
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-mono">
                    v{parsedVersion}
                  </Badge>
                </div>

                <div className="space-y-3.5 text-xs text-muted-foreground font-mono">
                  <div className="flex items-start justify-between gap-4">
                    <span>Installer:</span>
                    <span className="text-foreground text-right font-semibold truncate max-w-[200px]" title={parsedExeName}>
                      {parsedExeName}
                    </span>
                  </div>
                  {parsedSha512 && (
                    <div className="flex flex-col gap-1">
                      <span>SHA512 Checksum:</span>
                      <span className="text-foreground text-[10px] break-all bg-background p-1.5 rounded border border-muted">
                        {parsedSha512}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>ZIP contains {zipFiles.length} files</span>
                    <span className="italic">Including latest.yml & blockmap</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-xs font-bold text-foreground">Release Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Enter release notes, bug fixes, or new features..."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                    className="min-h-[80px] text-xs resize-none"
                    disabled={uploading}
                  />
                </div>

                {uploading ? (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs font-semibold text-foreground">
                      <span>Uploading build...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2 bg-muted-foreground/20" />
                  </div>
                ) : (
                  <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-md shadow-indigo-500/10">
                    Publish Release v{parsedVersion}
                  </Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>

        {/* History Table */}
        <Card className="lg:col-span-2 shadow-lg border-muted">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500" />
              Release History
            </CardTitle>
            <CardDescription>
              All published versions of LeapBlocks available to clients for update.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-3" />
                <span className="text-sm text-muted-foreground">Loading release catalog...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border rounded-xl border-dashed">
                <Terminal className="h-10 w-10 text-muted-foreground/60 mb-3" />
                <span className="text-sm font-semibold text-foreground">No versions published yet</span>
                <span className="text-xs text-muted-foreground mt-1 max-w-[280px] text-center">
                  Pack and upload your out.zip using the uploader panel to release your first build.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Version</TableHead>
                      <TableHead className="w-[150px]">Published Date</TableHead>
                      <TableHead>Release Notes</TableHead>
                      <TableHead className="w-[160px] text-right">Downloads</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((ver) => (
                      <TableRow key={ver.id} className={ver.isLatest ? "bg-indigo-500/5 hover:bg-indigo-500/10" : ""}>
                        <TableCell className="font-bold flex items-center gap-1.5">
                          <span className="font-mono text-sm">v{ver.version}</span>
                          {ver.isLatest && (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none py-0 px-1.5 text-[9px] font-bold">
                              LATEST
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 inline" />
                            {formatDate(ver.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={ver.releaseNotes || 'No notes provided'}>
                          {ver.releaseNotes || <span className="text-muted-foreground/50 italic">None</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <a
                              href={getFullDownloadUrl(ver.exeUrl)}
                              download
                              title="Download setup (.exe)"
                              className="inline-flex items-center justify-center p-1.5 border rounded-lg bg-background hover:bg-muted transition-colors text-indigo-500 hover:text-indigo-600 border-muted"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            {ver.latestYmlUrl && (
                              <a
                                href={getFullDownloadUrl(ver.latestYmlUrl)}
                                download
                                title="Download latest.yml"
                                className="inline-flex items-center justify-center p-1.5 border rounded-lg bg-background hover:bg-muted transition-colors text-muted-foreground border-muted"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {ver.blockmapUrl && (
                              <a
                                href={getFullDownloadUrl(ver.blockmapUrl)}
                                download
                                title="Download .blockmap"
                                className="inline-flex items-center justify-center p-1.5 border rounded-lg bg-background hover:bg-muted transition-colors text-muted-foreground border-muted"
                              >
                                <Layers className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
