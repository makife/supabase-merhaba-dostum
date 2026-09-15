/// <reference types="vite/client" />

declare module "*.obj?url" {
  const src: string;
  export default src;
}

declare module "*.fbx?url" {
  const src: string;
  export default src;
}
