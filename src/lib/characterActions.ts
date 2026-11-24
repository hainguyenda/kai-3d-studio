import * as THREE from 'three';

export interface CharacterRigParts {
  root: THREE.Object3D;
  head?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
}

/** Trả về true nếu action thuộc nhóm 5 động tác mới */
export function applyExtraCharacterAction(
  rig: CharacterRigParts,
  action: string,
  t: number
): boolean {
  const { root, head, leftArm, rightArm, leftLeg, rightLeg } = rig;

  switch (action) {
    case 'heavy_crouch': {
      // Khom gối, vai trĩu xuống, run nhẹ dưới trọng lực 2G
      root.position.y = -0.05 + Math.sin(t * 28) * 0.008;
      root.rotation.x = 0.22;
      root.rotation.z = Math.sin(t * 19) * 0.02;
      if (head) head.rotation.x = 0.15;
      if (leftArm) { leftArm.rotation.x = -0.35; leftArm.rotation.z = -0.25; }
      if (rightArm) { rightArm.rotation.x = -0.35; rightArm.rotation.z = 0.25; }
      if (leftLeg) leftLeg.rotation.x = -0.35;
      if (rightLeg) rightLeg.rotation.x = 0.25;
      return true;
    }

    case 'blown_wind': {
      // Nghiêng 32 độ chống bão, 2 tay che mặt
      root.position.y = Math.abs(Math.sin(t * 9)) * 0.04;
      root.rotation.z = 0.42 + Math.sin(t * 14) * 0.05; // nghiêng NGƯỢC chiều gió (gió thổi sang phải)
      root.rotation.x = 0.12;
      if (head) { head.rotation.z = -0.2; head.rotation.y = 0.25; }
      if (leftArm) { leftArm.rotation.x = -2.1 + Math.sin(t * 16) * 0.1; leftArm.rotation.z = -0.4; }
      if (rightArm) { rightArm.rotation.x = -1.9 + Math.cos(t * 15) * 0.1; rightArm.rotation.z = 0.45; }
      if (leftLeg) leftLeg.rotation.z = -0.18;
      if (rightLeg) rightLeg.rotation.z = 0.28;
      return true;
    }

    case 'jump_low': {
      // Nhảy gắng sức chỉ cao ~25cm rồi rơi phịch xuống
      const cycle = (t * 1.1) % 1;
      const hop = cycle < 0.45 ? Math.sin((cycle / 0.45) * Math.PI) * 0.28 : 0;
      const squash = cycle >= 0.45 && cycle < 0.65 ? -0.04 : 0;
      root.position.y = hop + squash;
      root.rotation.x = hop > 0.05 ? -0.08 : 0.12;
      if (leftArm) { leftArm.rotation.x = hop > 0.05 ? -1.2 : 0.2; leftArm.rotation.z = -0.2; }
      if (rightArm) { rightArm.rotation.x = hop > 0.05 ? -1.2 : 0.2; rightArm.rotation.z = 0.2; }
      return true;
    }

    case 'shiver': {
      // Ôm chặt tay vào người, run lập cập vì lạnh
      const tremor = Math.sin(t * 48) * 0.015;
      root.position.x += tremor;
      root.position.y = -0.05;
      root.rotation.x = 0.1;
      if (head) head.rotation.z = Math.sin(t * 40) * 0.04;
      if (leftArm) { leftArm.rotation.x = -0.85; leftArm.rotation.z = 0.55; }
      if (rightArm) { rightArm.rotation.x = -0.85; rightArm.rotation.z = -0.55; }
      return true;
    }

    case 'point_explain': {
      // Quay nhẹ sang phải, giơ tay giới thiệu biểu đồ bên cạnh
      root.position.y = Math.abs(Math.sin(t * 2.5)) * 0.025;
      root.rotation.y = 0.22;
      root.rotation.x = 0;
      root.rotation.z = 0;
      if (head) head.rotation.y = -0.12 + Math.sin(t * 1.6) * 0.05;
      if (leftArm) { leftArm.rotation.x = 0; leftArm.rotation.z = -0.12; }
      if (rightArm) {
        rightArm.rotation.x = -0.55;
        rightArm.rotation.z = 0.85 + Math.sin(t * 3.2) * 0.08;
      }
      return true;
    }

    default:
      return false;
  }
}
