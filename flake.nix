{
  description = "Development shell for jazz-tools-mcp-v2";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              pnpm
              git
              curl
              cacert
            ];

            shellHook = ''
              echo "jazz-tools-mcp-v2 development shell"
              echo "Node: $(node --version)"
              echo "npm:  $(npm --version)"
              echo "pnpm: $(pnpm --version)"
              echo
              echo "MCP verification:"
              echo "  npm install --no-audit --no-fund"
              echo "  npm run check && npm test && npm run build"
              echo
              echo "Inspector verification:"
              echo "  cd packages/inspector"
              echo "  pnpm install --frozen-lockfile"
              echo "  pnpm test && pnpm build"
              echo "  pnpm dev"
            '';
          };
        }
      );
    };
}
