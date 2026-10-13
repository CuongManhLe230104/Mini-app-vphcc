import logoImage from "../assets/logo_hcc.png";

function Logo({ className = "", style, ...props }) {
  return (
    <img
      {...props}
      src={logoImage}
      alt="Trung tâm Phục vụ hành chính công xã Nghĩa Thành"
      className={className}
      style={{
        width: 140,
        height: "auto",
        objectFit: "contain",
        display: "block",
        ...style,
      }}
    />
  );
}

export default Logo;