Page({
  createCard() {
    wx.navigateTo({
      url: '/pages/idea/edit?type=CARD',
    });
  },

  createRelic() {
    wx.navigateTo({
      url: '/pages/idea/edit?type=RELIC',
    });
  },

  createBuff() {
    wx.navigateTo({
      url: '/pages/idea/edit?type=BUFF',
    });
  },
});
