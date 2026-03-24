interface IConfig {
  baseUrl: string;
  imgUrl: string;
}


// const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;
const BACKEND_BASE_URL= 'http://localhost:4000/api'
const IMG_BASE_URL= 'http://localhost:4000/api/file/local?key='
export const Config: IConfig = {
  baseUrl: BACKEND_BASE_URL,
  imgUrl: IMG_BASE_URL
};