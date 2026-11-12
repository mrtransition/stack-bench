// Git 命令解释与常用命令生成
export const GIT_COMMANDS = [
  { cmd: 'git status', cat: '基础', desc: '查看工作区 / 暂存区状态（改动、未跟踪文件、当前分支）', options: ['-s 简短输出', '-b 显示分支信息'] },
  { cmd: 'git log', cat: '基础', desc: '查看提交历史', options: ['--oneline 单行显示', '-n N 最近 N 条', '--graph 图形化分支', '--author=xx 按作者过滤'] },
  { cmd: 'git diff', cat: '基础', desc: '查看未暂存的改动', options: ['--staged 查看已暂存改动', 'HEAD 与最近提交比较', '分支A 分支B 分支间比较'] },
  { cmd: 'git add', cat: '暂存', desc: '把改动加入暂存区', options: ['. 全部改动', '-p 逐块确认', '-A 包含删除与重命名'] },
  { cmd: 'git commit', cat: '暂存', desc: '提交暂存区内容', options: ['-m "msg" 提交信息', '--amend 修改最近提交', '-a 自动暂存已跟踪文件改动'] },
  { cmd: 'git push', cat: '远程', desc: '推送本地提交到远程', options: ['origin 分支 推送指定分支', '--force(-f) 强推（慎用）', '--tags 推送标签', '-u 首次推送并建立跟踪'] },
  { cmd: 'git pull', cat: '远程', desc: '拉取远程并合并到当前分支（fetch + merge）', options: ['--rebase 以 rebase 方式合并', '--ff-only 只允许快进'] },
  { cmd: 'git fetch', cat: '远程', desc: '下载远程更新但不合并', options: ['--prune 清理已删除的远程分支引用', 'origin 分支 拉取指定分支'] },
  { cmd: 'git clone', cat: '远程', desc: '克隆远程仓库', options: ['-b 分支 克隆指定分支', '--depth 1 浅克隆（只取最近提交）'] },
  { cmd: 'git branch', cat: '分支', desc: '查看 / 创建 / 删除分支', options: ['-a 含远程分支', '分支名 创建分支', '-d 分支 删除（已合并）', '-D 分支 强删'] },
  { cmd: 'git checkout', cat: '分支', desc: '切换分支或恢复文件', options: ['-b 新分支 创建并切换', '-- 文件 丢弃工作区改动', '提交~1 文件 恢复到指定版本'] },
  { cmd: 'git switch', cat: '分支', desc: '切换分支（新语法，更安全）', options: ['-c 新分支 创建并切换', '--detach 检出提交'] },
  { cmd: 'git merge', cat: '分支', desc: '合并指定分支到当前分支', options: ['--no-ff 保留合并节点', '--abort 中止合并', '--squash 压缩为一次提交'] },
  { cmd: 'git rebase', cat: '分支', desc: '变基：把当前分支提交挪到目标分支之上', options: ['--continue 继续', '--abort 中止', '-i HEAD~N 交互式整理提交'] },
  { cmd: 'git stash', cat: '暂存', desc: '临时保存工作区改动', options: ['list 查看', 'pop 恢复最近一次', 'save "msg" 带备注', 'drop 丢弃'] },
  { cmd: 'git reset', cat: '撤销', desc: '回退分支指针', options: ['--soft 保留改动在暂存区', '--mixed(默认) 保留在工作区', '--hard 彻底丢弃（危险）'] },
  { cmd: 'git revert', cat: '撤销', desc: '生成一次反向提交来撤销指定提交（安全）', options: ['-n 不立即提交', '提交A 提交B 批量撤销'] },
  { cmd: 'git cherry-pick', cat: '撤销', desc: '把其他分支的单个提交应用到当前分支', options: ['-n 只改工作区不提交', 'A..B 批量'] },
  { cmd: 'git tag', cat: '标签', desc: '查看 / 创建标签', options: ['v1.0.0 创建轻量标签', '-a v1.0.0 -m "msg" 附注标签', '-d 删除'] },
  { cmd: 'git remote', cat: '远程', desc: '管理远程仓库', options: ['-v 查看远程', 'add origin URL 添加', 'remove origin 移除', 'set-url 更新地址'] },
  { cmd: 'git blame', cat: '排查', desc: '逐行查看最后修改的提交', options: ['-L 范围 限定行区间', '-w 忽略空白'] },
  { cmd: 'git bisect', cat: '排查', desc: '二分定位引入 bug 的提交', options: ['start/bad/good 流程', 'reset 结束'] },
  { cmd: 'git worktree', cat: '高级', desc: '一个仓库同时检出多个工作目录', options: ['add 路径 分支', 'list', 'remove'] },
  { cmd: 'git reflog', cat: '排查', desc: '查看所有 HEAD 移动记录（找回丢失提交）', options: ['--date=iso 显示时间'] }
];

export function explainGit(input) {
  const s = String(input).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  // 精确匹配
  let hit = GIT_COMMANDS.find(c => c.cmd === s);
  // 前缀匹配（用户输入了额外参数）
  if (!hit) hit = GIT_COMMANDS.find(c => s.startsWith(c.cmd + ' '));
  // 主命令匹配
  if (!hit) {
    const main = s.split(' ').slice(0, 2).join(' ');
    hit = GIT_COMMANDS.find(c => c.cmd === main);
  }
  if (hit) {
    return {
      matched: true,
      cmd: hit.cmd,
      category: hit.cat,
      desc: hit.desc,
      options: hit.options,
      input
    };
  }
  const sub = s.replace(/^git\s+/, '').split(' ')[0];
  const near = GIT_COMMANDS.filter(c => c.cmd.split(' ')[1] === sub);
  return {
    matched: false,
    suggestion: near.length ? near : null,
    input
  };
}

export const GIT_CHEATSHEET = [
  { title: '日常开发', cmds: ['git status', 'git add -p', 'git commit -m "feat: xxx"', 'git push'] },
  { title: '同步远程', cmds: ['git fetch --prune', 'git pull --rebase', 'git push -u origin feature-x'] },
  { title: '分支操作', cmds: ['git switch -c feature-x', 'git merge --no-ff feature-x', 'git branch -d feature-x'] },
  { title: '撤销与找回', cmds: ['git reset --soft HEAD~1', 'git revert <commit>', 'git reflog', 'git checkout -- file'] },
  { title: '暂存现场', cmds: ['git stash', 'git stash pop', 'git stash list'] },
  { title: '排查问题', cmds: ['git log --oneline --graph -20', 'git blame -L 10,20 file', 'git bisect start'] }
];
