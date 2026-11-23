#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# 새 서버(Ubuntu, AWS Lightsail) 최초 준비
# 실행: 새 서버에서  sudo bash 01-server-setup.sh
# 하는 일: 시간대, 패키지 업데이트, Docker 설치, 스왑 2GB, 방화벽, 자동 보안 업데이트, 폴더
# 여러 번 실행해도 안전합니다.
# ──────────────────────────────────────────────────────────────
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "sudo 로 실행하세요."; exit 1; }
TARGET_USER="${SUDO_USER:-ubuntu}"

echo "== [1/6] 시간대 / 패키지 업데이트"
timedatectl set-timezone Asia/Seoul
apt-get update -q
DEBIAN_FRONTEND=noninteractive apt-get -yq upgrade
DEBIAN_FRONTEND=noninteractive apt-get -yq install ca-certificates curl gnupg git rsync unattended-upgrades

echo "== [2/6] Docker 설치 (공식 저장소)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  DEBIAN_FRONTEND=noninteractive apt-get -yq install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$TARGET_USER"
# 컨테이너 로그가 디스크를 채우지 않도록 크기 제한
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl enable --now docker
systemctl restart docker

echo "== [3/6] 스왑 2GB (프론트 빌드 때 메모리 여유)"
if ! swapon --show --noheadings | grep -q '^/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-maker3d.conf
sysctl -q -p /etc/sysctl.d/99-maker3d.conf

echo "== [4/6] 방화벽 (Lightsail 방화벽과 이중으로 22/80/443 만 허용)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

echo "== [5/6] 자동 보안 업데이트"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF

echo "== [6/6] 폴더 구조  /srv/maker3d/{repo,data}"
# data/api   : 올라온 파일 (주문, 저장한 견적, 게시판·공지 첨부, 포트폴리오)
# data/caddy : HTTPS 인증서
mkdir -p /srv/maker3d/data/api /srv/maker3d/data/caddy/data /srv/maker3d/data/caddy/config
chown -R "$TARGET_USER:$TARGET_USER" /srv/maker3d

cat <<MSG

────────────────────────────────────────────────────────────
준비 완료.
  Docker : $(docker --version)
  스왑   : $(swapon --show --noheadings | awk '{print $3}' | head -1)
  폴더   : /srv/maker3d/{repo,data}

docker 그룹은 다시 로그인해야 적용됩니다. 한 번 나갔다 들어온 뒤
  docker run --rm hello-world
가 되면 다음 단계(코드 받기)로 넘어가세요. deploy/README.md 참고.
────────────────────────────────────────────────────────────
MSG
