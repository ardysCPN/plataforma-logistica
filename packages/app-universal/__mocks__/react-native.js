module.exports = {
  Platform: {
    OS: 'web',
    select: (objs) => objs.web || objs.default,
  },
};
