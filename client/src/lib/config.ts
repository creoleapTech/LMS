interface IConfig {
  baseUrl: string;
  imgUrl: string;
  /** Proxy endpoint — hides real storage source (Drive, S3, etc.) from the client */
  proxyUrl: string;
  /** PPT preview endpoint — converts PPTX to PDF server-side */
  pptPreviewUrl: string;
}


// const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;
const BACKEND_BASE_URL= 'http://localhost:4000/api'
const IMG_BASE_URL= 'http://localhost:4000/api/file/local?key='
export const Config: IConfig = {
  baseUrl: BACKEND_BASE_URL,
  imgUrl: IMG_BASE_URL,
  proxyUrl: 'http://localhost:4000/api/file/proxy?key=',
  pptPreviewUrl: 'http://localhost:4000/api/file/ppt-preview?key=',
};