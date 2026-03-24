const TIME_OFFSET = 5 * 60 * 60 * 1000 + 30 * 60 * 1000; // 5 hours 30 minutes in milliseconds for IST

export const convertTime = (date: Date = new Date()): Date => {
  return new Date(date.getTime() + TIME_OFFSET);
};

export const getTime = (date: Date = new Date()): Date => {
  return new Date(date.getTime() + TIME_OFFSET);
};