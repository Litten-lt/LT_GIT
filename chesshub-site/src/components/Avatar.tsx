export default function Avatar() {
  return (
    <div className="flex justify-center">
      <div className="relative w-32 h-32 md:w-40 md:h-40">
        {/* 米色渐变占位（等真实头像替换） */}
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              'linear-gradient(135deg, #c58582 0%, #b87a8a 50%, #9d8090 100%)',
          }}
        />
        {/* 装饰：内圈高光 */}
        <div
          className="absolute inset-2 rounded-full opacity-50"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, transparent 60%)',
          }}
        />
        {/* 等真实头像后,改用:
          <img src="/avatar.png" alt="LongTeng" className="w-full h-full rounded-full object-cover" />
        */}
      </div>
    </div>
  )
}