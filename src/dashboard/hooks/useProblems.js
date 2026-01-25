import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllProblems, saveProblem, deleteProblem } from '../../../db.js';

export const useProblems = () => {
    const queryClient = useQueryClient();

    // Fetch all problems
    const { data: problems = [], isLoading, error } = useQuery({
        queryKey: ['problems'],
        queryFn: getAllProblems,
        staleTime: 1000 * 60 * 5, // 5 minutes fresh
    });

    // Save/Update problem mutation
    const saveProblemMutation = useMutation({
        mutationFn: saveProblem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['problems'] });
        },
    });

    // Delete problem mutation
    const deleteProblemMutation = useMutation({
        mutationFn: deleteProblem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['problems'] });
        },
    });

    return {
        problems,
        isLoading,
        error,
        saveProblem: saveProblemMutation.mutateAsync,
        deleteProblem: deleteProblemMutation.mutateAsync,
        isSaving: saveProblemMutation.isPending,
        isDeleting: deleteProblemMutation.isPending,
    };
};
