use git2::{Repository, IndexAddOption, Signature, RemoteCallbacks, Cred, PushOptions, FetchOptions, build::CheckoutBuilder};
use std::path::Path;
use serde::{Deserialize, Serialize};

/// A pair describing a conflict: the local (winning) file and the created conflict copy.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConflictPair {
    pub original: String,       // Relative path of the local (winning) file
    pub conflict_copy: String,  // Relative path of the newly created conflict copy
}

/// Result of a pull operation.
#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PullResult {
    pub had_changes: bool,
    pub had_conflicts: bool,
    pub conflict_pairs: Vec<ConflictPair>,
}

/// Ensures that a Git repository exists at the given path.
/// If it doesn't exist, it initializes a new one.
pub fn ensure_repo(path: &Path) -> Result<Repository, git2::Error> {
    match Repository::open(path) {
        Ok(repo) => Ok(repo),
        Err(_) => {
            Repository::init(path)
        }
    }
}

/// Commits all current changes in the working directory.
pub fn commit_changes(repo_path: &Path, message: &str) -> Result<(), git2::Error> {
    let repo = ensure_repo(repo_path)?;
    let mut index = repo.index()?;

    // Add all changes, deletions, and untracked files
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;

    let oid = index.write_tree()?;
    let signature = Signature::now("NotizApp Sync", "sync@notizapp.local")?;
    let tree = repo.find_tree(oid)?;

    // Handle initial commit (no parent) vs subsequent commits (has parent)
    match repo.head() {
        Ok(head) => {
            let parent_commit = head.peel_to_commit()?;
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[&parent_commit],
            )?;
        }
        Err(_) => {
            // Initial commit
            repo.commit(
                Some("HEAD"),
                &signature,
                &signature,
                message,
                &tree,
                &[],
            )?;
        }
    }

    Ok(())
}

/// Adds or updates the "origin" remote URL for the repository.
pub fn add_remote(repo_path: &Path, remote_url: &str) -> Result<(), git2::Error> {
    let repo = Repository::open(repo_path)?;
    
    match repo.find_remote("origin") {
        Ok(_) => {
            repo.remote_set_url("origin", remote_url)?;
        }
        Err(_) => {
            repo.remote("origin", remote_url)?;
        }
    }
    
    Ok(())
}

/// Pushes changes to the remote origin. Returns Ok(true) if push succeeded.
/// Automatically detects the remote's default branch name to avoid creating
/// spurious branches (e.g., pushing 'main' when remote uses 'master').
pub fn push_changes(repo_path: &Path, token: &str, username: &str) -> Result<bool, git2::Error> {
    let repo = Repository::open(repo_path)?;
    let mut remote = repo.find_remote("origin")?;

    // Detect local branch
    let head = repo.head()?;
    let local_branch = head.shorthand().unwrap_or("master");

    // Detect remote's default branch using the same logic as pull_changes
    let main_exists = repo.find_reference("refs/remotes/origin/main").is_ok();
    let master_exists = repo.find_reference("refs/remotes/origin/master").is_ok();
    let remote_has_local = repo.find_reference(&format!("refs/remotes/origin/{}", local_branch)).is_ok();

    let target_branch = if remote_has_local {
        // Remote has a branch matching our local name — use it
        local_branch.to_string()
    } else if master_exists {
        "master".to_string()
    } else if main_exists {
        "main".to_string()
    } else {
        // No remote branches yet (first push) — use local branch name
        local_branch.to_string()
    };

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext(username, token)
    });

    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);

    // Push local branch to the detected remote branch
    let refspec = format!("refs/heads/{}:refs/heads/{}", local_branch, target_branch);
    remote.push(&[&refspec], Some(&mut push_options))?;
    Ok(true)
}


/// Pulls changes from remote origin (fetches and merges/fast-forwards).
/// Returns a PullResult describing what happened, including any conflict copies created.
pub fn pull_changes(repo_path: &Path, token: &str, username: &str) -> Result<PullResult, git2::Error> {
    let repo = Repository::open(repo_path)?;
    let mut remote = repo.find_remote("origin")?;

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, _username_from_url, _allowed_types| {
        Cred::userpass_plaintext(username, token)
    });

    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);

    // 1. Fetch ALL branches to be sure we see main AND master
    remote.fetch(&["+refs/heads/*:refs/remotes/origin/*"], Some(&mut fetch_options), None)?;

    // 2. Identify what we want to pull. 
    // If our local branch exists on remote, use that.
    // Otherwise, try to find the remote's default branch (usually 'main' or 'master').
    let head = repo.head().ok();
    let local_branch = head.as_ref().and_then(|h| h.shorthand()).unwrap_or("main");
    
    let mut remote_refname = format!("refs/remotes/origin/{}", local_branch);
    
    // BRANCH SELECTION LOGIC:
    // If local is 'master' but remote only has 'main' (common case), use 'main'.
    // If local is 'main' but remote only has 'master', use 'master'.
    let main_exists = repo.find_reference("refs/remotes/origin/main").is_ok();
    let master_exists = repo.find_reference("refs/remotes/origin/master").is_ok();
    let remote_current_exists = repo.find_reference(&remote_refname).is_ok();

    if !remote_current_exists || (local_branch == "master" && main_exists && !master_exists) {
        if main_exists {
            remote_refname = "refs/remotes/origin/main".to_string();
        } else if master_exists {
            remote_refname = "refs/remotes/origin/master".to_string();
        }
    }
    
    let fetch_commit_obj = repo.find_reference(&remote_refname)
        .map_err(|e| e)?
        .peel_to_commit()?;
    let fetch_commit = repo.find_annotated_commit(fetch_commit_obj.id())?;

    let branch_name = local_branch.to_string(); // For use in snippets below
    if let Ok(head_ref) = repo.head() {
        let head_commit = repo.reference_to_annotated_commit(&head_ref)?;
        let analysis = repo.merge_analysis(&[&fetch_commit])?;

        if analysis.0.is_up_to_date() {
            // If we are up to date with the FETCH_HEAD of the current branch name, 
            // but still see No files, it might be because the remote uses a different branch name (main vs master).
            // Let's try to fetch its default branch if we have no common history yet.
            return Ok(PullResult::default());
        } else if analysis.0.is_fast_forward() {
            let refname = format!("refs/heads/{}", branch_name);
            let mut reference = repo.find_reference(&refname)?;
            reference.set_target(fetch_commit.id(), "Fast-Forward")?;
            repo.set_head(&refname)?;
            repo.checkout_head(Some(CheckoutBuilder::default().force()))?;
            return Ok(PullResult { had_changes: true, had_conflicts: false, conflict_pairs: vec![] });
        } else if analysis.0.is_normal() {
            let commit1 = repo.find_commit(head_commit.id())?;
            let commit2 = repo.find_commit(fetch_commit.id())?;

            let mut index = repo.merge_commits(&commit1, &commit2, None)?;

            if index.has_conflicts() {
                let mut conflict_pairs: Vec<ConflictPair> = Vec::new();

                // For each conflict: write remote content as a dated conflict copy file
                {
                    let conflicts_iter = index.conflicts()?;
                    for conflict in conflicts_iter {
                        let conflict = conflict?;

                        // Get the path from whichever side is available
                        let path_bytes = conflict.our
                            .as_ref().map(|e| e.path.clone())
                            .or_else(|| conflict.their.as_ref().map(|e| e.path.clone()))
                            .or_else(|| conflict.ancestor.as_ref().map(|e| e.path.clone()));

                        let path_str = match &path_bytes {
                            Some(b) => match std::str::from_utf8(b) {
                                Ok(s) => s.to_string(),
                                Err(_) => continue,
                            },
                            None => continue,
                        };

                        // Get the remote (their) blob content
                        let their_content = if let Some(their_entry) = &conflict.their {
                            match repo.find_blob(their_entry.id) {
                                Ok(blob) => Some(blob.content().to_vec()),
                                Err(_) => None,
                            }
                        } else {
                            None
                        };

                        if let Some(remote_content) = their_content {
                            // Build conflict copy filename: "Note (Konflikt YYYY-MM-DD).md"
                            let original_path = repo_path.join(&path_str);
                            let stem = original_path
                                .file_stem()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_default();
                            let ext = original_path
                                .extension()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "md".to_string());
                            let parent = original_path
                                .parent()
                                .unwrap_or(repo_path);

                            let date_str = chrono::Utc::now().format("%Y-%m-%d").to_string();
                            let conflict_filename = format!("{} (Konflikt {}).{}", stem, date_str, ext);
                            let conflict_path = parent.join(&conflict_filename);

                            // Write the remote version to the conflict copy
                            if let Err(e) = std::fs::write(&conflict_path, &remote_content) {
                                println!("Failed to write conflict copy: {}", e);
                                continue;
                            }

                            // Relative path from repo root for the conflict copy
                            let conflict_relative = conflict_path
                                .strip_prefix(repo_path)
                                .map(|p| p.to_string_lossy().replace("\\", "/"))
                                .unwrap_or(conflict_filename.clone());

                            conflict_pairs.push(ConflictPair {
                                original: path_str.replace("\\", "/"),
                                conflict_copy: conflict_relative,
                            });
                        }
                    }
                }

                // Reset index to HEAD (local wins), then add the new conflict copy files
                let head_commit_obj = repo.find_commit(head_commit.id())?;
                let head_tree = head_commit_obj.tree()?;
                repo.checkout_tree(head_tree.as_object(), Some(CheckoutBuilder::default().force()))?;
                let refname = format!("refs/heads/{}", branch_name);
                repo.set_head(&refname)?;

                // Now stage and commit the conflict copies
                let mut fresh_index = repo.index()?;
                fresh_index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
                fresh_index.write()?;
                let tree_id = fresh_index.write_tree()?;
                let tree = repo.find_tree(tree_id)?;
                let signature = Signature::now("NotizApp Sync", "sync@notizapp.local")?;
                let current_head = repo.find_commit(repo.head()?.peel_to_commit()?.id())?;
                repo.commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    "Conflict resolved: saved remote as conflict copies",
                    &tree,
                    &[&current_head],
                )?;

                return Ok(PullResult {
                    had_changes: true,
                    had_conflicts: true,
                    conflict_pairs,
                });
            }

            // Clean merge — no conflicts
            let tree_id = index.write_tree_to(&repo)?;
            let tree = repo.find_tree(tree_id)?;
            let signature = Signature::now("NotizApp Sync", "sync@notizapp.local")?;
            repo.commit(Some("HEAD"), &signature, &signature, "Merge remote changes", &tree, &[&commit1, &commit2])?;
            repo.checkout_head(Some(CheckoutBuilder::default().force()))?;
            return Ok(PullResult { had_changes: true, had_conflicts: false, conflict_pairs: vec![] });
        }
    } else {
        // No HEAD — checkout fetched commit directly (initial clone)
        let refname = format!("refs/heads/{}", branch_name);
        repo.reference(&refname, fetch_commit.id(), true, "Initial pull")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(CheckoutBuilder::default().force()))?;
        return Ok(PullResult { had_changes: true, had_conflicts: false, conflict_pairs: vec![] });
    }

    Ok(PullResult::default())
}
