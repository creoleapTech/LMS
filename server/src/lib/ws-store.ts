// lib/ws-store.ts
const adminConnections = new Set();
const userConnections = new Set();

export const addAdminWebSocket = (ws: any) => adminConnections.add(ws);
export const removeAdminWebSocket = (ws: any) => adminConnections.delete(ws);
export const addUserWebSocket = (ws: any) => userConnections.add(ws);
export const removeUserWebSocket = (ws: any) => userConnections.delete(ws);

export const broadcastMessageToAdmins = (message: unknown,type: any) => {
  adminConnections.forEach((ws: any) => {
    ws.send(JSON.stringify({ type: type, message: message }));
    console.log("Message sent to admins", message);
  });
};

export const broadcastMessageToUsers = (message: unknown,type: any) => {
  userConnections.forEach((ws: any) => {
    ws.send(JSON.stringify({ type: type, message: message }));
    console.log("Message sent to users", message);
  });
};
